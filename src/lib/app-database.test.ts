import { describe, expect, it, vi } from "vitest";

const { client } = vi.hoisted(() => ({ client: { from: vi.fn(), rpc: vi.fn() } }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: client }));

import { appDatabase } from "./app-database";

describe("migration schema client", () => {
  it("uses the existing authenticated connection without creating another client", () => {
    expect(appDatabase).toBe(client);
  });
});