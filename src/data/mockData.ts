import { ChatContact, Message, Story } from "@/types/chat";

export const mockContacts: ChatContact[] = [
  { id: "1", name: "Alex Morgan", avatar: "AM", lastMessage: "Hey! Check this out 🔥", time: "2m", unread: 3, online: true },
  { id: "2", name: "Sarah Chen", avatar: "SC", lastMessage: "The project is ready", time: "15m", unread: 1, online: true, typing: true },
  { id: "3", name: "Marcus Johnson", avatar: "MJ", lastMessage: "Let's meet tomorrow", time: "1h", unread: 0, online: false },
  { id: "4", name: "Luna Park", avatar: "LP", lastMessage: "Sent you the files 📎", time: "2h", unread: 0, online: true },
  { id: "5", name: "Dev Team", avatar: "DT", lastMessage: "Build deployed successfully ✅", time: "3h", unread: 5, online: false },
  { id: "6", name: "Emily Davis", avatar: "ED", lastMessage: "That's amazing!", time: "5h", unread: 0, online: false },
  { id: "7", name: "Jake Wilson", avatar: "JW", lastMessage: "Voice note 🎤", time: "1d", unread: 0, online: false },
];

export const mockMessages: Record<string, Message[]> = {
  "1": [
    { id: "m1", senderId: "1", text: "Hey! Have you seen the new update?", time: "10:30 AM", status: "read", type: "text" },
    { id: "m2", senderId: "me", text: "Not yet, what's new?", time: "10:31 AM", status: "read", type: "text" },
    { id: "m3", senderId: "1", text: "They added end-to-end encryption for group chats! 🔐", time: "10:32 AM", status: "read", type: "text" },
    { id: "m4", senderId: "me", text: "That's awesome! Security is everything 🛡️", time: "10:33 AM", status: "read", type: "text" },
    { id: "m5", senderId: "1", text: "Hey! Check this out 🔥", time: "10:35 AM", status: "delivered", type: "text" },
  ],
  "2": [
    { id: "m1", senderId: "2", text: "Hi! The project is almost done", time: "9:00 AM", status: "read", type: "text" },
    { id: "m2", senderId: "me", text: "Great! When can I review it?", time: "9:05 AM", status: "read", type: "text" },
    { id: "m3", senderId: "2", text: "The project is ready", time: "9:30 AM", status: "delivered", type: "text" },
  ],
};

export const mockStories: Story[] = [
  { id: "s1", userId: "me", userName: "Your Story", avatar: "YS", viewed: false },
  { id: "s2", userId: "1", userName: "Alex", avatar: "AM", viewed: false },
  { id: "s3", userId: "2", userName: "Sarah", avatar: "SC", viewed: true },
  { id: "s4", userId: "4", userName: "Luna", avatar: "LP", viewed: false },
  { id: "s5", userId: "5", userName: "Dev Team", avatar: "DT", viewed: true },
];
