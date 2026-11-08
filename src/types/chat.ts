export interface ChatContact {
  id: string;
  name: string;
  avatar: string;
  lastMessage: string;
  time: string;
  unread: number;
  online: boolean;
  typing?: boolean;
}

export interface Message {
  id: string;
  senderId: string;
  text: string;
  time: string;
  status: "sent" | "delivered" | "read" | "pending" | "queued";
  type: "text" | "image" | "voice" | "file";
  mediaUrl?: string;
  statusContext?: { caption: string; story_id: string };
}

export interface Story {
  id: string;
  userId: string;
  userName: string;
  avatar: string;
  viewed: boolean;
}
