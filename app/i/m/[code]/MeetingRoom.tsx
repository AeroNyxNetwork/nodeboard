/**
 * ============================================================================
 * AeroNyx meeting room — in the browser
 * ============================================================================
 *
 * [MEETING-WEB-GUEST 2026-09-17 by Claude]
 *
 * A visitor with the link joins from here, with no account and no install.
 * That is the Google-shaped part of a meeting, and it works because the relay
 * authenticates a keypair rather than a person — see lib/meetingGuest.ts.
 *
 * ⚠️ END-TO-END ENCRYPTION IS NOT OPTIONAL HERE.
 *
 * The key comes out of the link fragment and is handed to LiveKit's external
 * key provider before connect. If E2EE cannot be set up, this component does
 * NOT fall back to an unencrypted room — it refuses and says so. A meeting
 * that quietly downgrades is worse than one that will not start: everyone in
 * it believes something about the room that is no longer true, and the app
 * participants would still be encrypting, so the guest would hear nothing
 * anyway and blame their microphone.
 *
 * THE SERVER DECIDES WHETHER THERE IS A WAITING ROOM, not this page.
 *
 * A meeting has a host setting -- quick access, the same idea as Google Meet's
 * -- and the token endpoint enforces it. So the flow here is: ask for a token,
 * and only if the server answers 'admission_required' do we knock and ask
 * again. That ordering is what lets one page serve both meetings without
 * knowing the setting in advance, and there is no endpoint that would tell us:
 * a public "is this meeting open" answer would answer for every code a prober
 * cared to try.
 *
 * It also means the lobby is real. Before the server enforced it, knocking was
 * this page being polite -- a client that skipped the knock was handed the room
 * anyway, so the host's Admit button governed only guests who chose to ask.
 *
 * The knock is cancellable. Every way out of the waiting state -- the button,
 * leaving the page, the component unmounting -- withdraws the request, so a
 * host is never left looking at somebody who already left.
 * ============================================================================
 */

'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ExternalE2EEKeyProvider,
  LocalParticipant,
  Room,
  RoomEvent,
  Track,
  type RemoteParticipant,
} from 'livekit-client';
import {
  createGuestIdentity,
  requestMeetingToken,
  MeetingTokenError,
} from '@/lib/meetingGuest';
import {
  newAdmissionRequestId,
  requestAdmission,
  type AdmissionRequest,
} from '@/lib/meetingAdmission';

type Phase = 'idle' | 'knocking' | 'joining' | 'joined' | 'failed';

type Props = {
  code: string;
  e2eeKey: Uint8Array;
  displayName: string;
  labels: {
    knocking: string;
    rejected: string;
    timedOut: string;
    cancelKnock: string;
    retry: string;
    back: string;
    joining: string;
    leave: string;
    mic: string;
    micOff: string;
    camera: string;
    cameraOff: string;
    you: string;
    alone: string;
    failed: string;
    notFound: string;
    noE2EE: string;
  };
  onLeave: () => void;
};

export default function MeetingRoom({
  code,
  e2eeKey,
  displayName,
  labels,
  onLeave,
}: Props) {
  const [phase, setPhase] = useState<Phase>('idle');
  const [error, setError] = useState<string>('');
  // A meeting that does not exist will not exist on the next try either, and
  // offering Ask again there is an invitation to keep pressing a button that
  // cannot work.
  const [retryable, setRetryable] = useState(true);
  const [micOn, setMicOn] = useState(true);
  const [cameraOn, setCameraOn] = useState(true);
  const [peers, setPeers] = useState<RemoteParticipant[]>([]);
  const roomRef = useRef<Room | null>(null);
  const knockRef = useRef<AdmissionRequest | null>(null);
  const localVideoRef = useRef<HTMLVideoElement | null>(null);
  const remoteWrapRef = useRef<HTMLDivElement | null>(null);

  const teardown = useCallback(() => {
    // A knock outlives this component unless it is withdrawn: the relay socket
    // stays open for the full two-minute window and the host keeps seeing a
    // request from a browser that has already gone.
    const knock = knockRef.current;
    knockRef.current = null;
    knock?.cancel();

    const room = roomRef.current;
    roomRef.current = null;
    if (room) void room.disconnect();
  }, []);

  useEffect(() => () => teardown(), [teardown]);

  const join = useCallback(async () => {
    setError('');
    setRetryable(true);

    let room: Room | null = null;
    try {
      const identity = createGuestIdentity();

      // [MEETING-WEB-GUEST 2026-09-17 by Claude] Knock before entering. The
      // token would let this browser open the room on its own, which is
      // exactly why the waiting room has to come first — otherwise the host's
      // control over who is in their meeting is a button that does nothing.
      //
      // Same identity throughout: the decision is addressed to the key that
      // knocked, so a second keypair for the token would be a stranger.
      setPhase('joining');
      let token = await requestMeetingToken(identity, code, {
        withVideo: true,
      }).catch((err: unknown) => {
        if (
          err instanceof MeetingTokenError &&
          err.code === 'admission_required'
        ) {
          return null; // this host keeps a waiting room; knock below
        }
        throw err;
      });

      if (token === null) {
        setPhase('knocking');
        const knock = requestAdmission({
          // Same identity throughout: the host's decision is addressed to the
          // key that knocked, and the server records THAT key as admitted, so
          // a second keypair for the token would be a stranger again.
          seedHex: identity.seedHex,
          meetingCode: code,
          displayName,
          requestId: newAdmissionRequestId(code),
        });
        knockRef.current = knock;
        const verdict = await knock.outcome;
        knockRef.current = null;

        if (verdict.status === 'cancelled') {
          // Their own doing. Showing an error for something the person just
          // asked for reads as a malfunction.
          setPhase('idle');
          onLeave();
          return;
        }
        if (verdict.status !== 'admitted') {
          setPhase('failed');
          setError(
            verdict.status === 'rejected'
              ? labels.rejected
              : verdict.status === 'timeout'
                ? labels.timedOut
                : verdict.status === 'notFound'
                  ? labels.notFound
                  : labels.failed,
          );
          setRetryable(verdict.status !== 'notFound');
          return;
        }

        setPhase('joining');
        token = await requestMeetingToken(identity, code, { withVideo: true });
      }

      // The key provider has to exist before the Room, because E2EE is a
      // constructor option: there is no "turn it on later" that covers the
      // tracks published during connect.
      const keyProvider = new ExternalE2EEKeyProvider();
      // setKey takes an ArrayBuffer. .slice() rather than .buffer so a view
      // with an offset can never hand it the wrong 32 bytes — silently the
      // wrong key is the failure that sounds exactly like a broken mic.
      await keyProvider.setKey(e2eeKey.slice().buffer as ArrayBuffer);

      const worker = new Worker(
        new URL('livekit-client/e2ee-worker', import.meta.url),
      );

      room = new Room({
        adaptiveStream: true,
        dynacast: true,
        e2ee: { keyProvider, worker },
      });

      await room.setE2EEEnabled(true);

      room
        .on(RoomEvent.ParticipantConnected, () =>
          setPeers(Array.from(room!.remoteParticipants.values())),
        )
        .on(RoomEvent.ParticipantDisconnected, () =>
          setPeers(Array.from(room!.remoteParticipants.values())),
        )
        .on(RoomEvent.TrackSubscribed, (track, _pub, participant) => {
          if (!remoteWrapRef.current) return;
          if (
            track.kind === Track.Kind.Video ||
            track.kind === Track.Kind.Audio
          ) {
            const el = track.attach();
            el.setAttribute('data-peer', participant.identity);
            if (el instanceof HTMLVideoElement) {
              el.className = 'h-full w-full rounded-lg object-cover';
            }
            remoteWrapRef.current.appendChild(el);
          }
        })
        .on(RoomEvent.TrackUnsubscribed, (track) => {
          track.detach().forEach((el) => el.remove());
        })
        .on(RoomEvent.Disconnected, () => {
          setPhase('idle');
          onLeave();
        });

      await room.connect(token.livekitUrl, token.token);
      roomRef.current = room;

      await room.localParticipant.setMicrophoneEnabled(true);
      // A camera is nice to have, not a reason to fail: plenty of desktops
      // have none, and a meeting you can hear is still a meeting.
      try {
        await room.localParticipant.setCameraEnabled(true);
      } catch {
        setCameraOn(false);
      }
      attachLocalVideo(room.localParticipant, localVideoRef.current);

      setPeers(Array.from(room.remoteParticipants.values()));
      setPhase('joined');
    } catch (err) {
      if (room) void room.disconnect();
      roomRef.current = null;
      setPhase('failed');
      if (err instanceof MeetingTokenError) {
        const gone = err.code === 'meeting_not_found';
        setError(gone ? labels.notFound : labels.failed);
        setRetryable(!gone);
      } else if (String(err).toLowerCase().includes('e2ee')) {
        setError(labels.noE2EE);
      } else {
        setError(labels.failed);
      }
    }
  }, [code, e2eeKey, labels, onLeave]);

  useEffect(() => {
    void join();
    // join is stable for the life of this mount; re-running it would open a
    // second room while the first is still connected.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const toggleMic = async () => {
    const room = roomRef.current;
    if (!room) return;
    const next = !micOn;
    await room.localParticipant.setMicrophoneEnabled(next);
    setMicOn(next);
  };

  const toggleCamera = async () => {
    const room = roomRef.current;
    if (!room) return;
    const next = !cameraOn;
    await room.localParticipant.setCameraEnabled(next);
    setCameraOn(next);
    attachLocalVideo(room.localParticipant, localVideoRef.current);
  };

  const leave = () => {
    teardown();
    onLeave();
  };

  // [MEETING-WEB-GUEST 2026-09-17 by Claude] The failure card used to be one
  // line of text with nothing under it, while the text itself said "try again,
  // or open it in the app". Neither was possible: the link view hides its join
  // button for as long as this component is mounted, and nothing here ever
  // unmounted it. A guest whose host was slow to answer had to know to reload
  // the page. Copy that names an action has to be given the action.
  if (phase === 'failed') {
    return (
      <div className="mt-5 rounded-lg border border-white/10 bg-[#14141D] p-5 sm:p-6">
        <p className="text-sm leading-6 text-white/70">{error}</p>
        <div
          className={`mt-4 grid gap-3${retryable ? ' sm:grid-cols-2' : ''}`}
        >
          {retryable ? (
            <button
              type="button"
              onClick={() => void join()}
              className={PRIMARY}
            >
              {labels.retry}
            </button>
          ) : null}
          <button type="button" onClick={leave} className={SECONDARY}>
            {labels.back}
          </button>
        </div>
      </div>
    );
  }

  // Waiting is its own screen, not the room with the lights off. The room
  // chassis carries a mic, a camera and a leave button, and until the host
  // answers there is no Room for any of them to act on -- they were three
  // controls that silently did nothing, next to a black rectangle that looked
  // like a camera that had failed.
  if (phase === 'knocking') {
    return (
      <div className="mt-5 rounded-lg border border-white/10 bg-[#14141D] p-5 sm:p-6">
        <div className="flex items-center gap-3">
          <span
            aria-hidden="true"
            className="h-2 w-2 shrink-0 animate-pulse rounded-full bg-[#9B8CFF] motion-reduce:animate-none"
          />
          <p className="text-sm leading-6 text-white/70" role="status">
            {labels.knocking}
          </p>
        </div>
        <button
          type="button"
          onClick={leave}
          className={`${SECONDARY} mt-4 w-full`}
        >
          {labels.cancelKnock}
        </button>
      </div>
    );
  }

  return (
    <div className="mt-5 rounded-lg border border-white/10 bg-[#14141D] p-4 sm:p-5">
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="relative aspect-video overflow-hidden rounded-lg bg-black/60">
          <video
            ref={localVideoRef}
            autoPlay
            muted
            playsInline
            className="h-full w-full object-cover"
          />
          <span className="absolute bottom-2 left-2 rounded bg-black/60 px-2 py-0.5 text-xs text-white/80">
            {displayName} · {labels.you}
          </span>
        </div>
        <div
          ref={remoteWrapRef}
          className="relative aspect-video overflow-hidden rounded-lg bg-black/60"
        />
      </div>

      {phase === 'joined' && peers.length === 0 ? (
        <p className="mt-3 text-center text-xs text-white/40">{labels.alone}</p>
      ) : null}
      {phase === 'joining' ? (
        <p className="mt-3 text-center text-xs text-white/40" role="status">
          {labels.joining}
        </p>
      ) : null}

      <div className="mt-4 grid grid-cols-3 gap-2">
        <button
          type="button"
          onClick={toggleMic}
          className="flex h-11 items-center justify-center rounded-lg border border-white/15 text-sm font-medium text-white/85 transition-colors hover:bg-white/5"
        >
          {micOn ? labels.mic : labels.micOff}
        </button>
        <button
          type="button"
          onClick={toggleCamera}
          className="flex h-11 items-center justify-center rounded-lg border border-white/15 text-sm font-medium text-white/85 transition-colors hover:bg-white/5"
        >
          {cameraOn ? labels.camera : labels.cameraOff}
        </button>
        <button
          type="button"
          onClick={leave}
          className="flex h-11 items-center justify-center rounded-lg bg-[#D9455F] text-sm font-semibold text-white transition-colors hover:bg-[#E15872]"
        >
          {labels.leave}
        </button>
      </div>
    </div>
  );
}

const PRIMARY =
  'flex h-12 items-center justify-center rounded-lg bg-[#7762F3] px-5 text-sm ' +
  'font-semibold text-white transition-colors hover:bg-[#8877FF] ' +
  'focus:outline-none focus:ring-2 focus:ring-[#9B8CFF] focus:ring-offset-2 ' +
  'focus:ring-offset-[#0A0A0F]';

const SECONDARY =
  'flex h-12 items-center justify-center rounded-lg border border-white/15 ' +
  'px-5 text-sm font-semibold text-white/85 transition-colors ' +
  'hover:border-white/30 hover:bg-white/5 focus:outline-none focus:ring-2 ' +
  'focus:ring-white/40 focus:ring-offset-2 focus:ring-offset-[#0A0A0F]';

function attachLocalVideo(
  participant: LocalParticipant,
  element: HTMLVideoElement | null,
) {
  if (!element) return;
  const publication = participant.getTrackPublication(Track.Source.Camera);
  const track = publication?.videoTrack;
  if (track) track.attach(element);
}
