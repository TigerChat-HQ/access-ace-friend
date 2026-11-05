import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  update: vi.fn(),
  handlers: [] as Array<{ event: string; table: string; cb: (p: unknown) => void }>,
  memberData: { user_id: "user-123" } as { user_id: string } | null,
}));

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({ user: { id: "user-123" } }),
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: (table: string) => {
      if (table === "conversation_members") {
        return {
          select: () => ({
            eq: () => ({
              eq: () => ({
                maybeSingle: vi.fn().mockResolvedValue({ data: mocks.memberData }),
              }),
            }),
          }),
        };
      }
      if (table === "messages") {
        return {
          update: (payload: any) => {
            mocks.update(payload);
            const chain: any = {
              eq: () => chain,
              neq: () => chain,
              is: () => Promise.resolve({ error: null }),
            };
            return chain;
          },
        };
      }
      return {};
    },
    channel: () => {
      const ch = {
        on: (event: string, filterObj: any, cb: (p: any) => void) => {
          mocks.handlers.push({ event, table: filterObj?.table, cb });
          return ch;
        },
        subscribe: () => ch,
      };
      return ch;
    },
    removeChannel: vi.fn(),
  },
}));

import { useReadReceipts } from "./useReadReceipts";

describe("useReadReceipts", () => {
  beforeEach(() => {
    mocks.update.mockClear();
    mocks.handlers = [];
    mocks.memberData = { user_id: "user-123" };
  });

  it("marks all existing unread messages as delivered and read when conversation is active", async () => {
    renderHook(() => useReadReceipts("convo-1", true));

    expect(mocks.update).toHaveBeenCalledWith(
      expect.objectContaining({
        is_read: true,
        read_at: expect.any(String),
        delivered_at: expect.any(String),
      })
    );
  });

  it("marks incoming realtime message as read and delivered if user is actively viewing that conversation", async () => {
    renderHook(() => useReadReceipts("convo-1", true));
    mocks.update.mockClear();

    const insertListener = mocks.handlers.find(
      (h) => h.table === "messages"
    );
    expect(insertListener).toBeDefined();

    await act(async () => {
      await insertListener?.cb({
        new: {
          id: "msg-999",
          conversation_id: "convo-1",
          sender_id: "user-other",
          delivered_at: null,
          read_at: null,
        },
      });
    });

    expect(mocks.update).toHaveBeenCalledWith(
      expect.objectContaining({
        is_read: true,
        read_at: expect.any(String),
        delivered_at: expect.any(String),
      })
    );
  });

  it("marks incoming message only as delivered if conversation is not currently active", async () => {
    renderHook(() => useReadReceipts("convo-1", false));
    mocks.update.mockClear();

    const insertListener = mocks.handlers.find(
      (h) => h.table === "messages"
    );

    await act(async () => {
      await insertListener?.cb({
        new: {
          id: "msg-1000",
          conversation_id: "convo-2",
          sender_id: "user-other",
          delivered_at: null,
          read_at: null,
        },
      });
    });

    expect(mocks.update).toHaveBeenCalledWith(
      expect.objectContaining({
        delivered_at: expect.any(String),
      })
    );
    expect(mocks.update).not.toHaveBeenCalledWith(
      expect.objectContaining({
        is_read: true,
      })
    );
  });
});
