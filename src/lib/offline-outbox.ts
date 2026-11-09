import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { dispatchPush } from "@/lib/dispatch-push";

export interface QueuedMessage {
  id: string;
  conversationId: string;
  senderId: string;
  content: string;
  messageType: string;
  replyToId?: string | null;
  mediaUrl?: string | null;
  createdAt: string;
  status: "pending" | "sending" | "failed";
  retryCount: number;
  /** Stable database UUID reused for every retry to prevent duplicate messages. */
  messageId?: string;
  nextAttemptAt?: string | null;
}

const STORAGE_KEY = "tigerchats:offline-outbox-queue";

const createMessageId = (): string => {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") return crypto.randomUUID();
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (char) => {
    const random = Math.random() * 16 | 0;
    return (char === "x" ? random : (random & 0x3 | 0x8)).toString(16);
  });
};
const listeners = new Set<() => void>();

export const notifyOutboxListeners = () => {
  listeners.forEach((listener) => {
    try {
      listener();
    } catch (e) {
      console.error("Outbox listener error:", e);
    }
  });
};

export const subscribeOutbox = (callback: () => void) => {
  listeners.add(callback);
  return () => {
    listeners.delete(callback);
  };
};

export const getQueuedMessages = (conversationId?: string): QueuedMessage[] => {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed: QueuedMessage[] = JSON.parse(raw);
    // Upgrade older queued entries once, preserving their local queue IDs.
    let migrated = false;
    const list = parsed.map((message) => {
      if (message.messageId) return message;
      migrated = true;
      return { ...message, messageId: createMessageId(), nextAttemptAt: null };
    });
    if (migrated) localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
    if (!conversationId) return list;
    return list.filter((m) => m.conversationId === conversationId);
  } catch {
    return [];
  }
};

const saveQueuedMessages = (list: QueuedMessage[]) => {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
    notifyOutboxListeners();
  } catch (err) {
    console.warn("Failed to save offline outbox queue:", err);
  }
};

export const enqueueMessage = (
  item: Omit<QueuedMessage, "id" | "createdAt" | "status" | "retryCount">
): QueuedMessage => {
  const queued: QueuedMessage = {
    ...item,
    id: `queued_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    messageId: createMessageId(),
    createdAt: new Date().toISOString(),
    status: "pending",
    retryCount: 0,
    nextAttemptAt: null,
  };

  const list = getQueuedMessages();
  list.push(queued);
  saveQueuedMessages(list);

  // If online right now, attempt flush in background
  if (typeof navigator !== "undefined" && navigator.onLine) {
    void processOutbox();
  }

  return queued;
};

export const removeQueuedMessage = (id: string) => {
  const list = getQueuedMessages().filter((m) => m.id !== id);
  saveQueuedMessages(list);
};

let isProcessing = false;

export const processOutbox = async (force = false): Promise<number> => {
  if (typeof navigator !== "undefined" && !navigator.onLine) {
    return 0;
  }
  if (isProcessing) return 0;
  isProcessing = true;

  try {
    const list = getQueuedMessages();
    if (list.length === 0) {
      return 0;
    }

    let sentCount = 0;

    for (const msg of list) {
      if (typeof navigator !== "undefined" && !navigator.onLine) break;
      if (!force && msg.nextAttemptAt && new Date(msg.nextAttemptAt).getTime() > Date.now()) continue;

      msg.status = "sending";
      notifyOutboxListeners();

      try {
        const payload: Database["public"]["Tables"]["messages"]["Insert"] = {
          id: msg.messageId || createMessageId(),
          conversation_id: msg.conversationId,
          sender_id: msg.senderId,
          created_at: msg.createdAt,
          content: msg.content,
          message_type: msg.messageType,
          reply_to_id: msg.replyToId || null,
        };
        if (msg.mediaUrl) {
          payload.media_url = msg.mediaUrl;
        }

        // Upsert against the stable primary key makes retries idempotent even if
        // the server committed a message but the client lost the response.
        const { data, error } = await supabase.from("messages")
          .upsert(payload, { onConflict: "id", ignoreDuplicates: true })
          .select("id")
          .maybeSingle();

        if (error) {
          console.warn("Outbox message send failed:", error);
          msg.status = "failed";
          msg.retryCount = (msg.retryCount || 0) + 1;
          const delayMs = Math.min(5 * 60 * 1000, 2000 * (2 ** Math.min(msg.retryCount, 7)));
          msg.nextAttemptAt = new Date(Date.now() + delayMs).toISOString();
          saveQueuedMessages(list);
          if (!navigator.onLine || /fetch|network|timeout|connection/i.test(error.message || "")) {
            break;
          }
        } else {
          removeQueuedMessage(msg.id);
          sentCount++;
          // An empty result means this stable message ID already existed; do not
          // dispatch a duplicate push notification for an idempotent retry.
          if (data?.id) void dispatchPush(msg.conversationId);
        }
      } catch (err) {
        console.warn("Outbox processing error:", err);
        msg.status = "failed";
        msg.retryCount = (msg.retryCount || 0) + 1;
        const delayMs = Math.min(5 * 60 * 1000, 2000 * (2 ** Math.min(msg.retryCount, 7)));
        msg.nextAttemptAt = new Date(Date.now() + delayMs).toISOString();
        saveQueuedMessages(list);
        break;
      }
    }

    return sentCount;
  } finally {
    isProcessing = false;
    notifyOutboxListeners();
  }
};

// Global background auto-sync when connection comes back online
if (typeof window !== "undefined") {
  window.addEventListener("online", () => {
    console.log("Network online: processing offline message outbox...");
    setTimeout(() => {
      void processOutbox();
    }, 800);
  });

  // Periodic flush every 15 seconds if items exist
  setInterval(() => {
    if (navigator.onLine) {
      const pending = getQueuedMessages();
      if (pending.length > 0) {
        void processOutbox();
      }
    }
  }, 15000);
}
