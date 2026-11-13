/**
 * Single-WebView microphone ownership guard.
 *
 * Android WebView exposes one microphone capture resource to the app. Calls and
 * voice notes must not open independent getUserMedia sessions at the same time.
 * The owner releases its lease only after its MediaStream tracks are stopped.
 */
let activeMicrophoneOwner: string | null = null;

export function acquireMicrophone(owner: "voice-note" | "voice-call" | "video-call"): () => void {
  if (activeMicrophoneOwner) {
    throw new Error(
      activeMicrophoneOwner === "voice-note"
        ? "Simamisha Voice Note inayoendelea kabla ya kuanzisha simu."
        : "Microphone tayari inatumiwa na simu ya TigerChat. Maliza simu kwanza."
    );
  }

  activeMicrophoneOwner = owner;
  let released = false;

  return () => {
    if (released) return;
    released = true;
    if (activeMicrophoneOwner === owner) activeMicrophoneOwner = null;
  };
}

export function getActiveMicrophoneOwner(): string | null {
  return activeMicrophoneOwner;
}
