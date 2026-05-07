import { useEffect, useState, useCallback } from "react";

const KEY_ENABLED = "tigerchats:applock:enabled";
const KEY_CRED_ID = "tigerchats:applock:credId";
const KEY_UNLOCKED = "tigerchats:applock:unlocked"; // sessionStorage

const b64uToBuf = (b64u: string) => {
  const b64 = b64u.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(b64u.length / 4) * 4, "=");
  const bin = atob(b64);
  const buf = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) buf[i] = bin.charCodeAt(i);
  return buf.buffer;
};
const bufToB64u = (buf: ArrayBuffer) => {
  const bin = String.fromCharCode(...new Uint8Array(buf));
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
};

export const isWebAuthnSupported = () =>
  typeof window !== "undefined" && !!window.PublicKeyCredential;

export const useAppLock = () => {
  const [enabled, setEnabled] = useState(false);
  const [locked, setLocked] = useState(false);

  useEffect(() => {
    const en = localStorage.getItem(KEY_ENABLED) === "1";
    setEnabled(en);
    if (en) {
      const unlocked = sessionStorage.getItem(KEY_UNLOCKED) === "1";
      setLocked(!unlocked);
    }
  }, []);

  const enable = useCallback(async (): Promise<boolean> => {
    if (!isWebAuthnSupported()) throw new Error("Biometrics not supported on this device");
    const challenge = crypto.getRandomValues(new Uint8Array(32));
    const userId = crypto.getRandomValues(new Uint8Array(16));
    const cred = (await navigator.credentials.create({
      publicKey: {
        rp: { name: "TIGERCHATS" },
        user: { id: userId, name: "tigerchats-user", displayName: "TIGERCHATS" },
        challenge,
        pubKeyCredParams: [{ type: "public-key", alg: -7 }, { type: "public-key", alg: -257 }],
        authenticatorSelection: { userVerification: "required", authenticatorAttachment: "platform" },
        timeout: 60000,
      },
    })) as PublicKeyCredential | null;
    if (!cred) return false;
    localStorage.setItem(KEY_CRED_ID, bufToB64u(cred.rawId));
    localStorage.setItem(KEY_ENABLED, "1");
    sessionStorage.setItem(KEY_UNLOCKED, "1");
    setEnabled(true);
    setLocked(false);
    return true;
  }, []);

  const disable = useCallback(() => {
    localStorage.removeItem(KEY_ENABLED);
    localStorage.removeItem(KEY_CRED_ID);
    sessionStorage.removeItem(KEY_UNLOCKED);
    setEnabled(false);
    setLocked(false);
  }, []);

  const unlock = useCallback(async (): Promise<boolean> => {
    const credIdB64 = localStorage.getItem(KEY_CRED_ID);
    if (!credIdB64) {
      // Fallback: just unlock
      sessionStorage.setItem(KEY_UNLOCKED, "1");
      setLocked(false);
      return true;
    }
    const challenge = crypto.getRandomValues(new Uint8Array(32));
    try {
      const assertion = await navigator.credentials.get({
        publicKey: {
          challenge,
          allowCredentials: [{ id: b64uToBuf(credIdB64), type: "public-key" }],
          userVerification: "required",
          timeout: 60000,
        },
      });
      if (!assertion) return false;
      sessionStorage.setItem(KEY_UNLOCKED, "1");
      setLocked(false);
      return true;
    } catch {
      return false;
    }
  }, []);

  return { enabled, locked, enable, disable, unlock };
};
