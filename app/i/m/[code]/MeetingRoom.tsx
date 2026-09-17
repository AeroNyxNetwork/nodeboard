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
  DisconnectReason,
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
    noMic: string;
    share: string;
    stopSharing: string;
    sharingLabel: string;
    camera: string;
    cameraOff: string;
    you: string;
    alone: string;
    failed: string;
    notFound: string;
    meetingEnded: string;
    removed: string;
    joinedElsewhere: string;
    disconnected: string;
    verifyEmoji: string;
    verifyEmojiLabel: string;
    roomFull: string;
    clockOff: string;
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
  // The device said no, as opposed to the person having muted themselves.
  // Those need different words on the button.
  const [micBlocked, setMicBlocked] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [cameraOn, setCameraOn] = useState(true);
  const [peers, setPeers] = useState<RemoteParticipant[]>([]);
  // [MEETING-WEB-GRID 2026-09-17 by Claude] Bumped on every track event so
  // each tile re-runs its attach. A participant can join before their camera
  // publishes, so the tile has to be told to look again rather than only on
  // mount.
  const [trackVersion, setTrackVersion] = useState(0);
  // [MEETING-VERIFY-EMOJI 2026-09-17 by Claude] The same four emoji the app
  // shows for this room. Two people can read them to each other and know they
  // are inside the same encrypted meeting -- which matters more here than
  // anywhere else, because the key travelled in a link that anyone could have
  // been forwarded.
  const [verifyEmoji, setVerifyEmoji] = useState<string[]>([]);
  const roomRef = useRef<Room | null>(null);
  const knockRef = useRef<AdmissionRequest | null>(null);
  const localVideoRef = useRef<HTMLVideoElement | null>(null);
  // Audio elements are attached here, off-layout. They were going into the
  // remote video tile, where an <audio> element occupied space in a box meant
  // for a picture.
  const audioSinkRef = useRef<HTMLDivElement | null>(null);

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
          if (track.kind === Track.Kind.Audio) {
            // Sound does not need a box. Attaching audio into the video tile
            // put an <audio> element inside a fixed-aspect picture frame.
            const el = track.attach();
            el.setAttribute('data-peer', participant.identity);
            audioSinkRef.current?.appendChild(el);
            return;
          }
          if (track.kind === Track.Kind.Video) {
            // Covers Source.Camera and Source.ScreenShare alike -- the render
            // decides which tile each belongs in.
            setPeers(Array.from(room!.remoteParticipants.values()));
            setTrackVersion((v) => v + 1);
          }
        })
        .on(RoomEvent.TrackUnsubscribed, (track) => {
          track.detach().forEach((el) => el.remove());
          setTrackVersion((v) => v + 1);
        })
        .on(RoomEvent.Disconnected, (reason) => {
          // [MEETING-WEB-ENDED 2026-09-17 by Claude] Leaving on your own is
          // the only disconnect that needs no words. Everything else --
          // the host ending the meeting, being removed, the connection
          // dropping -- used to unmount this component and return the person
          // to the landing page with nothing said at all, which reads as the
          // page having crashed rather than the meeting having ended.
          if (reason === DisconnectReason.CLIENT_INITIATED) {
            setPhase('idle');
            onLeave();
            return;
          }
          roomRef.current = null;
          setPhase('failed');
          setRetryable(reason !== DisconnectReason.PARTICIPANT_REMOVED);
          setError(
            reason === DisconnectReason.ROOM_DELETED ||
              reason === DisconnectReason.ROOM_CLOSED
              ? labels.meetingEnded
              : reason === DisconnectReason.PARTICIPANT_REMOVED
                ? labels.removed
                : reason === DisconnectReason.DUPLICATE_IDENTITY
                  ? labels.joinedElsewhere
                  : labels.disconnected,
          );
        });

      await room.connect(token.livekitUrl, token.token);
      roomRef.current = room;

      // [MEETING-WEB-NO-MIC 2026-09-17 by Claude] A microphone is not a
      // condition of entry. This was the one unguarded await after connect,
      // and the failure it produced was the worst shape available: the room
      // connected, E2EE came up, then the catch disconnected it, RoomEvent
      // .Disconnected fired onLeave, and the whole component unmounted -- so
      // someone who clicked Block on the permission prompt was returned to
      // the entry page with no error and no explanation at all. Seen exactly
      // that way against production.
      //
      // Listening is a legitimate way to attend a meeting. Join muted.
      try {
        await room.localParticipant.setMicrophoneEnabled(true);
      } catch {
        setMicOn(false);
        setMicBlocked(true);
      }
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
      void verificationEmoji(e2eeKey).then((codes) => {
        if (roomRef.current) setVerifyEmoji(codes);
      });
    } catch (err) {
      if (room) void room.disconnect();
      roomRef.current = null;
      setPhase('failed');
      if (err instanceof MeetingTokenError) {
        // [MEETING-TOKEN-COPY 2026-09-17 by Claude] The server distinguishes
        // these; saying "could not reach the meeting" to all of them throws
        // away the one piece of information the person needs.
        //
        // A full room can empty and an off clock can be corrected, so both
        // keep Ask again. A meeting that has ended will not exist on the next
        // try either, so that one does not.
        const gone = err.code === 'meeting_not_found';
        const full = err.code === 'room_full';
        const clock = err.code === 'timestamp_expired';
        setError(
          gone
            ? labels.notFound
            : full
              ? labels.roomFull
              : clock
                ? labels.clockOff
                : labels.failed,
        );
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
    try {
      await room.localParticipant.setMicrophoneEnabled(next);
      setMicOn(next);
      setMicBlocked(false);
    } catch {
      // Unmuting with no microphone cannot work, and a button that does
      // nothing is worse than one that says why.
      setMicOn(false);
      setMicBlocked(true);
    }
  };

  // [MEETING-WEB-SHARE 2026-09-17 by Claude] The card above this room has
  // said "video, screen sharing and a waiting room" since the day it shipped,
  // and the web had no way to share anything. livekit-client drives
  // getDisplayMedia itself; all this has to do is ask, and not lie about the
  // result when the browser or the person says no.
  const toggleShare = async () => {
    const room = roomRef.current;
    if (!room) return;
    const next = !sharing;
    try {
      await room.localParticipant.setScreenShareEnabled(next);
      setSharing(next);
    } catch {
      // Cancelling the picker lands here too, and that is not an error worth
      // shouting about -- it is someone changing their mind.
      setSharing(false);
    }
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

  // Recomputed on every track event, which is what trackVersion is for.
  const screenShares = peers.filter(
    (peer) =>
      peer.getTrackPublication(Track.Source.ScreenShare)?.videoTrack != null,
  );

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
      {/* [MEETING-WEB-GRID 2026-09-17 by Claude] One tile per person. Every
          remote track used to be appended into a single fixed-aspect box, so a
          third person in the room drew on top of the second and only the last
          one subscribed was visible at all. */}
      {/* A shared screen is the thing everyone is looking at, so it gets the
          full width above the faces rather than a slot among them. */}
      {screenShares.map((peer) => (
        <ScreenShareTile
          key={`share-${peer.sid}`}
          participant={peer}
          trackVersion={trackVersion}
          label={labels.sharingLabel}
        />
      ))}
      <div className={`grid gap-3 ${gridColumns(peers.length + 1)}`}>
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
        {peers.map((peer) => (
          <PeerTile
            key={peer.sid}
            participant={peer}
            trackVersion={trackVersion}
          />
        ))}
      </div>
      <div ref={audioSinkRef} className="hidden" />

      {phase === 'joined' && verifyEmoji.length === 4 ? (
        <div className="mt-3 flex items-center justify-center gap-2">
          <span
            className="select-all text-base leading-none tracking-[0.15em]"
            aria-label={labels.verifyEmojiLabel}
          >
            {verifyEmoji.join('')}
          </span>
          <span className="text-xs text-white/40">{labels.verifyEmoji}</span>
        </div>
      ) : null}
      {phase === 'joined' && peers.length === 0 ? (
        <p className="mt-3 text-center text-xs text-white/40">{labels.alone}</p>
      ) : null}
      {phase === 'joining' ? (
        <p className="mt-3 text-center text-xs text-white/40" role="status">
          {labels.joining}
        </p>
      ) : null}

      <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
        <button
          type="button"
          onClick={toggleMic}
          className="flex h-11 items-center justify-center rounded-lg border border-white/15 text-sm font-medium text-white/85 transition-colors hover:bg-white/5"
        >
          {micBlocked ? labels.noMic : micOn ? labels.mic : labels.micOff}
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
          onClick={toggleShare}
          className="flex h-11 items-center justify-center rounded-lg border border-white/15 text-sm font-medium text-white/85 transition-colors hover:bg-white/5"
        >
          {sharing ? labels.stopSharing : labels.share}
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

// [MEETING-VERIFY-EMOJI 2026-09-17 by Claude] This table and this derivation
// MIRROR voice_active_call_screen.dart. They are a shared secret's fingerprint,
// so they are only worth anything if both sides compute the identical four --
// a drift here does not produce a wrong-looking code, it produces two people
// reading different emoji at each other and concluding they are in different
// rooms.
//
// The app's chain, followed exactly:
//   seed  = 'AeroNyx-CallVerify-v1:' + lowercase hex of sha256(key)
//   emoji = table[ sha256(utf8(seed))[i] % 64 ]  for i in 0..3
//
// Note the SECOND hash is over the hex STRING, not over the digest bytes.
const VERIFY_EMOJI_TABLE = [
  '\u{1F436}', '\u{1F431}', '\u{1F42D}', '\u{1F439}', '\u{1F430}',
  '\u{1F98A}', '\u{1F43B}', '\u{1F43C}', '\u{1F428}', '\u{1F42F}',
  '\u{1F981}', '\u{1F42E}', '\u{1F437}', '\u{1F438}', '\u{1F435}',
  '\u{1F414}', '\u{1F986}', '\u{1F989}', '\u{1F987}', '\u{1F43A}',
  '\u{1F417}', '\u{1F434}', '\u{1F984}', '\u{1F41D}', '\u{1F41B}',
  '\u{1F98B}', '\u{1F40C}', '\u{1F41E}', '\u{1F997}', '\u{1F982}',
  '\u{1F422}', '\u{1F98E}', '\u{1F338}', '\u{1F33A}', '\u{1F33B}',
  '\u{1F33C}', '\u{1F337}', '\u{1F340}', '\u{1F33F}', '\u{1F343}',
  '\u{1F30A}', '\u{1F525}', '\u{2728}', '\u{2B50}', '\u{1F319}',
  '\u{2600}\u{FE0F}', '\u{26A1}', '\u{1F308}', '\u{1F3B5}', '\u{1F3B6}',
  '\u{1F3B8}', '\u{1F3B9}', '\u{1F3BA}', '\u{1F941}', '\u{1F3AF}',
  '\u{1F3B2}', '\u{1F3C6}', '\u{1F381}', '\u{1F38A}', '\u{1F389}',
  '\u{1F30D}', '\u{1F30F}', '\u{1F30E}', '\u{1F5FA}\u{FE0F}',
];

function toHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

async function sha256(data: Uint8Array): Promise<Uint8Array> {
  const buf = await crypto.subtle.digest(
    'SHA-256',
    data.slice().buffer as ArrayBuffer,
  );
  return new Uint8Array(buf);
}

async function verificationEmoji(key: Uint8Array): Promise<string[]> {
  try {
    const seed = `AeroNyx-CallVerify-v1:${toHex(await sha256(key))}`;
    const digest = await sha256(new TextEncoder().encode(seed));
    return Array.from(digest.slice(0, 4)).map(
      (b) => VERIFY_EMOJI_TABLE[b % VERIFY_EMOJI_TABLE.length],
    );
  } catch {
    // No fingerprint is honest. A wrong one would be worse than none.
    return [];
  }
}

/// How many columns for n tiles.
///
/// Deliberately not a formula: two people side by side, four in a square, and
/// a hard stop at three columns because a tile narrower than that on a phone
/// is a thumbnail of a face nobody can read.
function gridColumns(count: number): string {
  if (count <= 1) return 'grid-cols-1';
  if (count <= 2) return 'grid-cols-1 sm:grid-cols-2';
  if (count <= 4) return 'grid-cols-2';
  return 'grid-cols-2 sm:grid-cols-3';
}

/// Somebody's shared screen.
///
/// Separate from PeerTile because a screen is not a face: it wants the full
/// width, `object-contain` so a wide desktop is not cropped to a 16:9 slot,
/// and no name badge covering the bottom-left of what is being shown.
function ScreenShareTile({
  participant,
  trackVersion,
  label,
}: {
  participant: RemoteParticipant;
  trackVersion: number;
  label: string;
}) {
  const ref = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const track = participant.getTrackPublication(Track.Source.ScreenShare)
      ?.videoTrack;
    if (!track) return;
    track.attach(el);
    return () => {
      track.detach(el);
    };
  }, [participant, trackVersion]);

  const name =
    participant.name?.trim() || `${participant.identity.slice(0, 8)}\u2026`;

  return (
    <div className="mb-3 overflow-hidden rounded-lg bg-black/70">
      <video
        ref={ref}
        autoPlay
        playsInline
        className="max-h-[60vh] w-full object-contain"
      />
      <p className="px-3 py-1.5 text-xs text-white/50">
        {name} \u00b7 {label}
      </p>
    </div>
  );
}

/// One remote participant.
///
/// The attach runs in an effect keyed on trackVersion, because a person can be
/// in the room before their camera publishes -- and often is, since joining and
/// turning a camera on are two separate moments.
function PeerTile({
  participant,
  trackVersion,
}: {
  participant: RemoteParticipant;
  trackVersion: number;
}) {
  const ref = useRef<HTMLVideoElement | null>(null);
  const [hasVideo, setHasVideo] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const track = participant.getTrackPublication(Track.Source.Camera)
      ?.videoTrack;
    if (!track) {
      setHasVideo(false);
      return;
    }
    track.attach(el);
    setHasVideo(true);
    return () => {
      track.detach(el);
    };
  }, [participant, trackVersion]);

  const name =
    participant.name?.trim() || `${participant.identity.slice(0, 8)}…`;

  return (
    <div className="relative aspect-video overflow-hidden rounded-lg bg-black/60">
      <video
        ref={ref}
        autoPlay
        playsInline
        className="h-full w-full object-cover"
      />
      {!hasVideo ? (
        // A camera that is off is not a broken tile. Say whose it is.
        <span className="absolute inset-0 flex items-center justify-center text-sm text-white/35">
          {name}
        </span>
      ) : null}
      <span className="absolute bottom-2 left-2 max-w-[calc(100%-1rem)] truncate rounded bg-black/60 px-2 py-0.5 text-xs text-white/80">
        {name}
      </span>
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
