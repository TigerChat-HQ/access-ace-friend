import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  token: vi.fn().mockResolvedValue("device-token"),
  upsert: vi.fn().mockResolvedValue({ error: null }),
  remove: vi.fn(),
  eq: vi.fn(),
  supported: vi.fn().mockResolvedValue(true),
  permission: vi.fn().mockResolvedValue("granted"),
}));
vi.mock("firebase/app", () => ({ getApps: () => [], initializeApp: vi.fn() }));
vi.mock("firebase/messaging", () => ({ getMessaging: vi.fn(), getToken: mocks.token, deleteToken: vi.fn(), isSupported: mocks.supported }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: { from: () => ({ upsert: mocks.upsert, delete: mocks.remove }) } }));
import { disablePush, enablePush, isPushEnabled } from "./firebase-push";

describe("Firebase device notifications", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    for (const [key, value] of Object.entries({ WEB_API_KEY: "public-web-key", PROJECT_ID: "test-project", APP_ID: "1:123:web:abc", VAPID_KEY: "public-vapid" })) {
      vi.stubEnv(`VITE_LOVABLE_CONNECTOR_FIREBASE_MESSAGING_${key}`, value);
    }
    vi.stubGlobal("Notification", { permission: "granted", requestPermission: mocks.permission });
    Object.defineProperty(navigator, "serviceWorker", { configurable: true, value: { register: vi.fn().mockResolvedValue({}) } });
    mocks.eq.mockReturnValue({ eq: vi.fn().mockResolvedValue({ error: null }) });
    mocks.remove.mockReturnValue({ eq: mocks.eq });
  });

  it("requires web push configuration before asking permission", async () => {
    vi.stubEnv("VITE_LOVABLE_CONNECTOR_FIREBASE_MESSAGING_VAPID_KEY", "");
    expect(await enablePush("user-a")).toContain("Include web push");
    expect(mocks.permission).not.toHaveBeenCalled();
    expect(mocks.upsert).not.toHaveBeenCalled();
  });

  it("stores the registration privately for the current user", async () => {
    expect(await enablePush("user-a")).toContain("enabled");
    expect(mocks.upsert).toHaveBeenCalledWith({ user_id: "user-a", token: "device-token" }, { onConflict: "token" });
    expect(isPushEnabled("user-a")).toBe(true);
    expect(isPushEnabled("user-b")).toBe(false);
    expect(navigator.serviceWorker.register).toHaveBeenCalledWith(expect.stringContaining("messagingSenderId=123"));
  });

  it("removes only the current user's device registration when disabled", async () => {
    localStorage.setItem("tiger-push:user-a", "device-token");
    await disablePush("user-a");
    expect(mocks.eq).toHaveBeenCalledWith("user_id", "user-a");
    expect(isPushEnabled("user-a")).toBe(false);
  });
});