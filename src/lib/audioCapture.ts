/**
 * Tiger Audio Engine — single microphone owner inside this JavaScript runtime.
 *
 * Calls and voice notes share one WebView runtime, so only one may acquire the
 * microphone lease at a time. Android still controls capture arbitration between
 * this app and other apps; this guard cannot lock the device-wide microphone.
 */
type MicrophoneOwner = "voice-note" | "voice-call" | "video-call";

type ActiveLease = {
  owner: MicrophoneOwner;
  token: symbol;
};

let activeLease: ActiveLease | null = null;

/**
 * Acquire exclusive microphone ownership for a call or voice note.
 * The returned release function is idempotent and token-safe: an old cleanup
 * can never release a newer lease, even if both sessions have the same owner.
 */
export function acquireMicrophone(owner: MicrophoneOwner): () => void {
  if (activeLease) {
    throw new Error(
      activeLease.owner === "voice-note"
        ? "Simamisha Voice Note inayoendelea kabla ya kuanzisha simu."
        : "Microphone tayari inatumiwa na simu ya TigerChat. Maliza simu kwanza."
    );
  }

  const lease: ActiveLease = { owner, token: Symbol(owner) };
  activeLease = lease;
  let released = false;

  return () => {
    if (released) return;
    released = true;
    if (activeLease?.token === lease.token) activeLease = null;
  };
}

/** Current owner for UI diagnostics and deterministic tests. */
export function getActiveMicrophoneOwner(): MicrophoneOwner | null {
  return activeLease?.owner ?? null;
}

/** True only for a lease held by this JavaScript runtime, not other apps. */
export function isMicrophoneOwned(): boolean {
  return activeLease !== null;
}
