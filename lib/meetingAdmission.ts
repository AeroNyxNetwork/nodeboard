/**
 * ============================================================================
 * AeroNyx meeting admission — the guest knocks, the host answers
 * ============================================================================
 *
 * [MEETING-WEB-GUEST 2026-09-17 by Claude]
 *
 * Holding the link gets you a token, and a token opens the room. That is not
 * the same as being let in, and this is the difference: the guest announces
 * itself over the relay and waits for the host to decide.
 *
 * The backend routes it. relay/consumers._handle_meeting_admission looks the
 * code up in Redis, finds the single host who claimed it, and forwards the
 * request to exactly that person. The decision comes back addressed to
 * requester_pubkey — which the server takes from the AUTHENTICATED connection,
 * never from the frame, so nobody can put someone else's key in a host's
 * waiting list and collect the admission meant for them.
 *
 * ⚠️ This waits and it can time out, and a timeout is NOT an admission. Every
 * path out of here is explicit: admitted, rejected, timed out, or the relay
 * never came up. A "maybe" that resolves to "yes" is how a waiting room stops
 * being one.
 * ============================================================================
 */

import { RelayClient } from './relayClient';

export type AdmissionOutcome =
  | { status: 'admitted' }
  | { status: 'rejected' }
  | { status: 'timeout' }
  | { status: 'unreachable' }
  // The guest stopped waiting. Distinct from 'timeout' on purpose: nobody
  // failed to answer, so telling this person "nobody answered" would be a
  // report about the host that is not true.
  | { status: 'cancelled' };

/** How long a guest waits before giving up on a host who never answered. */
const ADMISSION_TIMEOUT_MS = 120_000;

/** How long to wait for the relay handshake itself. */
const CONNECT_TIMEOUT_MS = 12_000;

type AdmissionFrame = {
  type?: string;
  request_id?: string;
  meeting_code?: string;
};

export type AdmissionRequest = {
  /** Resolves exactly once, with one of the four outcomes. */
  readonly outcome: Promise<AdmissionOutcome>;
  /**
   * Withdraws the knock: tells the host, then stops waiting.
   *
   * Sending the withdrawal is the point. Closing the socket quietly would
   * leave the host looking at a request from someone who has already walked
   * away, with no way to learn that from their side.
   */
  cancel(): void;
};

/**
 * Knocks on a meeting and waits for the host.
 *
 * [seedHex] is the guest's ephemeral private key — the same identity that will
 * hold the LiveKit token, because the host's decision is addressed to it.
 */
export function requestAdmission(options: {
  seedHex: string;
  meetingCode: string;
  displayName: string;
  requestId: string;
}): AdmissionRequest {
  const { seedHex, meetingCode, displayName, requestId } = options;
  const relay = new RelayClient(seedHex);

  let settle: ((outcome: AdmissionOutcome) => void) | null = null;
  let connectTimer: ReturnType<typeof setTimeout> | null = null;
  let waitTimer: ReturnType<typeof setTimeout> | null = null;

  const finish = (outcome: AdmissionOutcome) => {
    if (!settle) return;
    const resolve = settle;
    settle = null;
    if (connectTimer) clearTimeout(connectTimer);
    if (waitTimer) clearTimeout(waitTimer);
    relay.close();
    resolve(outcome);
  };

  const outcome = new Promise<AdmissionOutcome>((resolve) => {
    settle = resolve;
  });

  connectTimer = setTimeout(
    () => finish({ status: 'unreachable' }),
    CONNECT_TIMEOUT_MS,
  );

  relay.on('connected', () => {
    if (connectTimer) clearTimeout(connectTimer);
    // The clock starts when the host could first have seen the request, not
    // when the page loaded: a slow relay must not eat the waiting window.
    waitTimer = setTimeout(
      () => finish({ status: 'timeout' }),
      ADMISSION_TIMEOUT_MS,
    );
    relay.send({
      type: 'group_meeting_admission_request',
      // No group_id: that is the whole point of a meeting. The server reads
      // the code, finds the host, and routes to that one person.
      meeting_code: meetingCode,
      request_id: requestId,
      requester_name: displayName,
      room_name: '',
    });
  });

  relay.on('authfail', () => finish({ status: 'unreachable' }));
  relay.on('closed', () => {
    // Only meaningful while still waiting; finish() closes the socket itself.
    if (settle) finish({ status: 'unreachable' });
  });

  relay.on('meetingadmission', (data) => {
    const frame = (data ?? {}) as AdmissionFrame;
    // Ignore an answer to somebody else's knock — a host may be admitting
    // several people at once, and every decision reaches every waiting guest.
    if (frame.request_id && frame.request_id !== requestId) return;
    finish({
      status:
        frame.type === 'group_meeting_admission_admit'
          ? 'admitted'
          : 'rejected',
    });
  });

  relay.connect();

  return {
    outcome,
    cancel: () => {
      // Best effort, and deliberately not awaited: relay.send() returns false
      // when the socket never opened, which is the case where there is no
      // host waiting list to clear anyway. A browser flushes queued frames
      // before the close handshake, so sending here and closing below still
      // puts the withdrawal on the wire.
      relay.send({
        type: 'group_meeting_admission_cancel',
        meeting_code: meetingCode,
        request_id: requestId,
        requester_name: displayName,
        room_name: '',
      });
      relay.close();
      finish({ status: 'cancelled' });
    },
  };
}

/** A request id a host can tell apart from every other knock. */
export function newAdmissionRequestId(meetingCode: string): string {
  const entropy = Math.random().toString(36).slice(2, 10);
  return `web-${meetingCode}-${Date.now().toString(36)}-${entropy}`;
}
