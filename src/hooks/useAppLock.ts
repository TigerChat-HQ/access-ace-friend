import { useEffect, useCallback, useSyncExternalStore } from "react";

const KEY_ENABLED = "tigerchats:applock:enabled";
const KEY_CRED_ID = "tigerchats:applock:credId";
const listeners = new Set<() => void>();
let unlocked = false;
let snapshot = { enabled: localStorage.getItem(KEY_ENABLED) === "1", locked: localStorage.getItem(KEY_ENABLED) === "1" };
const notify = () => {
  const enabled = localStorage.getItem(KEY_ENABLED) === "1";
  snapshot = { enabled, locked: enabled && !unlocked };
  listeners.forEach(listener => listener());
};
const subscribe = (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener); }; };
const b64uToBuf = (value: string) => Uint8Array.from(atob(value.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(value.length / 4) * 4, "=")), c => c.charCodeAt(0));
export const isWebAuthnSupported = () => typeof window !== "undefined" && window.isSecureContext && !!window.PublicKeyCredential;

export const useAppLock = () => {
  const state = useSyncExternalStore(subscribe, () => snapshot);
  useEffect(() => {
    const visibility = () => { if (document.hidden) { unlocked = false; notify(); } };
    const storage = () => { unlocked = false; notify(); };
    document.addEventListener("visibilitychange", visibility);
    window.addEventListener("storage", storage);
    return () => { document.removeEventListener("visibilitychange", visibility); window.removeEventListener("storage", storage); };
  }, []);
  const enable = useCallback(async () => {
    if (!isWebAuthnSupported()) throw new Error("This device does not support biometric verification.");
    if (window.top !== window.self) throw new Error("Open TIGERCHATS in its own tab to enable biometrics.");
    if (!await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable()) throw new Error("Set up fingerprint, Face ID or a device PIN first.");
    const credential = await navigator.credentials.create({ publicKey: {
      rp: { name: "TIGERCHATS" },
      user: { id: crypto.getRandomValues(new Uint8Array(16)), name: "tigerchats-user", displayName: "TIGERCHATS" },
      challenge: crypto.getRandomValues(new Uint8Array(32)),
      pubKeyCredParams: [{ type: "public-key", alg: -7 }, { type: "public-key", alg: -257 }],
      authenticatorSelection: { userVerification: "required", authenticatorAttachment: "platform" }, timeout: 60000,
    } });
    if (!(credential instanceof PublicKeyCredential)) return false;
    localStorage.setItem(KEY_CRED_ID, btoa(String.fromCharCode(...new Uint8Array(credential.rawId))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, ""));
    localStorage.setItem(KEY_ENABLED, "1"); unlocked = true; notify(); return true;
  }, []);
  const unlock = useCallback(async () => {
    const id = localStorage.getItem(KEY_CRED_ID);
    if (!id || window.top !== window.self) return false;
    try {
      const assertion = await navigator.credentials.get({ publicKey: { challenge: crypto.getRandomValues(new Uint8Array(32)), allowCredentials: [{ id: b64uToBuf(id), type: "public-key" }], userVerification: "required", timeout: 60000 } });
      if (!assertion) return false;
      unlocked = true; notify(); return true;
    } catch { return false; }
  }, []);
  const disable = useCallback(() => { localStorage.removeItem(KEY_ENABLED); localStorage.removeItem(KEY_CRED_ID); unlocked = false; notify(); }, []);
  return { ...state, enable, disable, unlock };
};