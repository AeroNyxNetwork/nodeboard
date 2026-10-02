/**
 * ============================================================================
 * AeroNyx meeting pre-join preview
 * ============================================================================
 * [MEETING-PREJOIN 2026-10-02 by Codex]
 * A deliberate, user-triggered camera/microphone check before joining. Merely
 * opening a meeting link never activates a device; the person chooses when to
 * preview, then carries the same mute/video preferences into the room.
 * ============================================================================
 */

'use client';

import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from 'react';

export type MeetingPreviewHandle = { stop: () => void };

type Props = {
  cameraOn: boolean;
  micOn: boolean;
  onCameraChange: (enabled: boolean) => void;
  onMicChange: (enabled: boolean) => void;
  labels: {
    checkDevices: string;
    previewHint: string;
    deviceError: string;
    cameraOn: string;
    cameraOff: string;
    micOn: string;
    micOff: string;
  };
};

const MeetingPreview = forwardRef<MeetingPreviewHandle, Props>(
  function MeetingPreview(
    { cameraOn, micOn, onCameraChange, onMicChange, labels },
    ref,
  ) {
    const videoRef = useRef<HTMLVideoElement | null>(null);
    const streamRef = useRef<MediaStream | null>(null);
    // [MEETING-PREVIEW-CANCEL 2026-10-02 by Codex] A permission prompt may
    // resolve after join/unmount; stale requests must immediately stop tracks.
    const requestRef = useRef(0);
    const preferencesRef = useRef({ micOn, cameraOn });
    preferencesRef.current = { micOn, cameraOn };
    const [starting, setStarting] = useState(false);
    const [active, setActive] = useState(false);
    const [failed, setFailed] = useState(false);

    const stop = useCallback(() => {
      requestRef.current += 1;
      streamRef.current?.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
      if (videoRef.current) videoRef.current.srcObject = null;
      setActive(false);
      setStarting(false);
    }, []);

    useImperativeHandle(ref, () => ({ stop }), [stop]);
    useEffect(() => stop, [stop]);

    useEffect(() => {
      streamRef.current?.getAudioTracks().forEach((track) => {
        track.enabled = micOn;
      });
    }, [micOn]);

    useEffect(() => {
      streamRef.current?.getVideoTracks().forEach((track) => {
        track.enabled = cameraOn;
      });
    }, [cameraOn]);

    const start = async () => {
      if (starting || active) return;
      const request = ++requestRef.current;
      setStarting(true);
      setFailed(false);
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: true,
          video: { facingMode: 'user' },
        });
        if (request !== requestRef.current) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }
        stream.getAudioTracks().forEach((track) => {
          track.enabled = preferencesRef.current.micOn;
        });
        stream.getVideoTracks().forEach((track) => {
          track.enabled = preferencesRef.current.cameraOn;
        });
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play().catch(() => undefined);
        }
        if (request === requestRef.current) setActive(true);
      } catch {
        if (request !== requestRef.current) return;
        stop();
        setFailed(true);
      } finally {
        if (request === requestRef.current) setStarting(false);
      }
    };

    return (
      <section aria-label={labels.previewHint} className="overflow-hidden rounded-2xl border border-white/10 bg-[#0D0D14] shadow-xl shadow-black/20">
        <div className="relative aspect-video min-h-[210px] overflow-hidden bg-black/65">
          <video
            ref={videoRef}
            autoPlay
            muted
            playsInline
            className={`h-full w-full object-cover transition-opacity ${active && cameraOn ? 'opacity-100' : 'opacity-0'}`}
          />
          {!active || !cameraOn ? (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 px-6 text-center">
              <img src="/meeting/cap_video_off.png" alt="" aria-hidden="true" width={56} height={56} className="h-14 w-14" />
              <p className="max-w-sm text-sm leading-6 text-white/45">
                {failed ? labels.deviceError : labels.previewHint}
              </p>
              {!active ? (
                <button
                  type="button"
                  onClick={() => void start()}
                  disabled={starting}
                  className="rounded-xl border border-white/15 bg-white/5 px-4 py-2 text-sm font-semibold text-white/80 transition-colors hover:bg-white/10 focus:outline-none focus:ring-2 focus:ring-[#9B8CFF]/60 disabled:cursor-wait disabled:opacity-60"
                >
                  {starting ? '…' : labels.checkDevices}
                </button>
              ) : null}
            </div>
          ) : null}

          <div className="absolute bottom-3 left-1/2 flex -translate-x-1/2 gap-2 rounded-2xl border border-white/10 bg-black/55 p-2 backdrop-blur-md">
            <button
              type="button"
              onClick={() => onMicChange(!micOn)}
              aria-label={micOn ? labels.micOff : labels.micOn}
              title={micOn ? labels.micOff : labels.micOn}
              className={`flex h-11 w-11 items-center justify-center rounded-xl border transition-colors focus:outline-none focus:ring-2 focus:ring-[#9B8CFF]/60 ${micOn ? 'border-white/15 bg-white/5' : 'border-[#E0A33E]/50 bg-[#E0A33E]/15'}`}
            >
              <img src={`/meeting/${micOn ? 'cap_mic' : 'cap_mic_off'}.png`} alt="" aria-hidden="true" width={26} height={26} />
            </button>
            <button
              type="button"
              onClick={() => onCameraChange(!cameraOn)}
              aria-label={cameraOn ? labels.cameraOff : labels.cameraOn}
              title={cameraOn ? labels.cameraOff : labels.cameraOn}
              className={`flex h-11 w-11 items-center justify-center rounded-xl border transition-colors focus:outline-none focus:ring-2 focus:ring-[#9B8CFF]/60 ${cameraOn ? 'border-white/15 bg-white/5' : 'border-[#E0A33E]/50 bg-[#E0A33E]/15'}`}
            >
              <img src={`/meeting/${cameraOn ? 'cap_video' : 'cap_video_off'}.png`} alt="" aria-hidden="true" width={26} height={26} />
            </button>
          </div>
        </div>
      </section>
    );
  },
);

export default MeetingPreview;
