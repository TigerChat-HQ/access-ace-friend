import { supabase } from "@/integrations/supabase/client";
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
}

const STORAGE_KEY = "tigerchats:offline-outbox-queue";
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
    const list: QueuedMessage[] = JSON.parse(raw);
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
    createdAt: new Date().toISOString(),
    status: "pending",
    retryCount: 0,
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

export const processOutbox = async (): Promise<number> => {
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

      msg.status = "sending";
      notifyOutboxListeners();

      try {
        const payload: Record<string, unknown> = {
          conversation_id: msg.conversationId,
          sender_id: msg.senderId,
          content: msg.content,
          message_type: msg.messageType,
          reply_to_id: msg.replyToId || null,
        };
        if (msg.mediaUrl) {
          payload.media_url = msg.mediaUrl;
        }

        const { error } = await supabase.from("messages").insert(payload as any);

        if (error) {
          console.warn("Outbox message send failed:", error);
          msg.status = "failed";
          msg.retryCount = (msg.retryCount || 0) + 1;
          saveQueuedMessages(list);
          if (!navigator.onLine || error.message?.includes("fetch") || error.message?.includes("network")) {
            break;
          }
        } else {
          removeQueuedMessage(msg.id);
          sentCount++;
          void dispatchPush(msg.conversationId);
        }
      } catch (err) {
        console.warn("Outbox processing error:", err);
        msg.status = "failed";
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
