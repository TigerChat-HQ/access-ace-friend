/**
 * Tiger Audio Engine — single microphone owner inside this JavaScript runtime.
 *
 * Calls and voice notes share one WebView runtime, so only one may acquire the
 * microphone lease at a time. Android still controls capture arbitration between
 * this app and other apps; this guard cannot lock the device-wide microphone.
 */
type MicrophoneOwner = "voice-note" | "voice-call" | "video-call";

import { supabase } from "@/integrations/supabase/client";

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

/**
 * Cross-device/session microphone lock shared by the website and Android WebView.
 * Each signed-in account gets one private-in-practice topic name derived from its
 * user id. Presence disappears automatically when a client disconnects.
 */
export async function acquireSharedMicrophone(owner: MicrophoneOwner): Promise<() => void> {
  const localRelease = acquireMicrophone(owner);
  let channel: ReturnType<typeof supabase.channel> | null = null;
  try {
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    if (sessionError) throw sessionError;
    if (!session?.user?.id) throw new Error("Ingia kwenye akaunti yako ya TigerChat ili kutumia microphone.");

    const bytes = new TextEncoder().encode(session.user.id);
    const digest = await crypto.subtle.digest("SHA-256", bytes);
    const accountKey = Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
    const clientId = typeof crypto.randomUUID === "function"
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const topic = `tiger-audio:${accountKey}`;

    channel = supabase.channel(topic, { config: { presence: { key: clientId } } });
    let syncVersion = 0;
    const syncWaiters: Array<() => void> = [];
    channel.on("presence", { event: "sync" }, () => {
      syncVersion += 1;
      syncWaiters.splice(0).forEach((resolve) => resolve());
    });
    const waitForSyncAfter = (version: number, timeoutMs: number) => new Promise<void>((resolve, reject) => {
      if (syncVersion > version) return resolve();
      const timeout = setTimeout(() => {
        const index = syncWaiters.indexOf(done);
        if (index >= 0) syncWaiters.splice(index, 1);
        reject(new Error("TigerChat haijapata uthibitisho wa vifaa vingine. Kagua intaneti kisha jaribu tena."));
      }, timeoutMs);
      const done = () => { clearTimeout(timeout); resolve(); };
      syncWaiters.push(done);
    });

    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error("TigerChat imeshindwa kuunganisha ulinzi wa microphone. Kagua intaneti kisha jaribu tena.")), 8000);
      channel!.subscribe((status, err) => {
        if (status === "SUBSCRIBED") {
          clearTimeout(timeout);
          resolve();
        } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT" || status === "CLOSED") {
          clearTimeout(timeout);
          reject(err ?? new Error("TigerChat Realtime microphone lock haijaunganishwa."));
        }
      });
    });
    await waitForSyncAfter(0, 5000);

    const hasOtherOwner = () => Object.values(channel!.presenceState<{ owner: string; clientId: string }>())
      .flat()
      .some((presence) => presence.clientId !== clientId && Boolean(presence.owner));

    if (hasOtherOwner()) {
      throw new Error("Microphone tayari inatumika kwenye website au APK nyingine ya akaunti hii ya TigerChat. Maliza matumizi hayo kwanza.");
    }

    const beforeTrack = syncVersion;
    const tracked = await channel.track({
      owner,
      clientId,
      device: window.TigerNative?.getAppVersion?.() ? "android-app" : "website",
      startedAt: new Date().toISOString(),
    });
    if (tracked !== "ok") throw new Error("TigerChat imeshindwa kutangaza matumizi ya microphone kwenye vifaa vingine.");

    // Wait for server-confirmed presence sync; simultaneous starters both back off.
    await waitForSyncAfter(beforeTrack, 5000);
    if (hasOtherOwner()) {
      throw new Error("Kifaa kingine cha TigerChat kimeanza kutumia microphone. Simamisha sauti huko kwanza.");
    }

    let released = false;
    return () => {
      if (released) return;
      released = true;
      localRelease();
      if (channel) {
        const activeChannel = channel;
        channel = null;
        void activeChannel.untrack().finally(() => supabase.removeChannel(activeChannel));
      }
    };
  } catch (error) {
    localRelease();
    if (channel) void supabase.removeChannel(channel);
    throw error;
  }
}

/** Current owner for UI diagnostics and deterministic tests. */
export function getActiveMicrophoneOwner(): MicrophoneOwner | null {
  return activeLease?.owner ?? null;
}

/** True only for a lease held by this JavaScript runtime, not other apps. */
export function isMicrophoneOwned(): boolean {
  return activeLease !== null;
}
