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
 * What this deliberately does not do yet: the waiting room. An app host admits
 * people over the relay WS, and a guest that cannot be admitted simply joins
 * the room it already has a token for. Wiring the guest into that handshake is
 * the next piece; until then a guest reaches the room as any token holder does.
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

type Phase = 'idle' | 'joining' | 'joined' | 'failed';

type Props = {
  code: string;
  e2eeKey: Uint8Array;
  displayName: string;
  labels: {
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
  const [micOn, setMicOn] = useState(true);
  const [cameraOn, setCameraOn] = useState(true);
  const [peers, setPeers] = useState<RemoteParticipant[]>([]);
  const roomRef = useRef<Room | null>(null);
  const localVideoRef = useRef<HTMLVideoElement | null>(null);
  const remoteWrapRef = useRef<HTMLDivElement | null>(null);

  const teardown = useCallback(() => {
    const room = roomRef.current;
    roomRef.current = null;
    if (room) void room.disconnect();
  }, []);

  useEffect(() => () => teardown(), [teardown]);

  const join = useCallback(async () => {
    setPhase('joining');
    setError('');

    let room: Room | null = null;
    try {
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

      const identity = createGuestIdentity();
      const token = await requestMeetingToken(identity, code, {
        withVideo: true,
      });

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
        setError(
          err.code === 'meeting_not_found' ? labels.notFound : labels.failed,
        );
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

  if (phase === 'failed') {
    return (
      <div className="rounded-lg border border-white/10 bg-[#14141D] p-5 sm:p-6">
        <p className="text-sm text-white/70">{error}</p>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-white/10 bg-[#14141D] p-4 sm:p-5">
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
        <p className="mt-3 text-center text-xs text-white/40">
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

function attachLocalVideo(
  participant: LocalParticipant,
  element: HTMLVideoElement | null,
) {
  if (!element) return;
  const publication = participant.getTrackPublication(Track.Source.Camera);
  const track = publication?.videoTrack;
  if (track) track.attach(element);
}
