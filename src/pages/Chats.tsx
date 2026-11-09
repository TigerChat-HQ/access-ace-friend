import { useState, useEffect, useRef, useMemo } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useConversations, useMessages } from "@/hooks/useChat";
import { useChatMessageFeatures } from "@/hooks/useChatMessageFeatures";
import { useTypingIndicator } from "@/hooks/useTypingIndicator";
import { useNotifications } from "@/hooks/useNotifications";
import { StoriesBar } from "@/components/chat/StoriesBar";
import { ChatListItem } from "@/components/chat/ChatListItem";
import { MessageBubble } from "@/components/chat/MessageBubble";
import { MessageInput } from "@/components/chat/MessageInput";
import { StoryViewer } from "@/components/chat/StoryViewer";
import { useCall } from "@/contexts/CallContext";
import { useReadReceipts } from "@/hooks/useReadReceipts";
import { useScreenshotProtection } from "@/hooks/useScreenshotProtection";
import { TigerChatBackground } from "@/components/chat/TigerChatBackground";
import { InviteMembersDialog } from "@/components/chat/InviteMembersDialog";
import { ForwardDialog } from "@/components/chat/ForwardDialog";
import { GroupAdminDialog } from "@/components/chat/GroupAdminDialog";
import { ChatCustomizationDialog, wallpaperClass, bubbleColorClass, fontSizeClass } from "@/components/chat/ChatCustomizationDialog";
import { useChatPreferences } from "@/hooks/useChatPreferences";
import { NewDmDialog } from "@/components/chat/NewDmDialog";
import { NewGroupDialog } from "@/components/chat/NewGroupDialog";
import { StoryUploadDialog } from "@/components/chat/StoryUploadDialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSub, DropdownMenuSubContent, DropdownMenuSubTrigger, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Search, MessageCircle, ArrowLeft, Phone, Video, MoreVertical, EyeOff, Trash2, X, ChevronUp, ChevronDown, Archive, RotateCcw, Palette, UserPlus, Settings, LogOut, Clock } from "lucide-react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";
import { Tables } from "@/integrations/supabase/types";
import { Message } from "@/types/chat";
import tigerLogo from "@/assets/tigerchats-logo.png";
import { dispatchPush } from "@/lib/dispatch-push";
import { enqueueMessage, getQueuedMessages, removeQueuedMessage, subscribeOutbox, processOutbox, QueuedMessage } from "@/lib/offline-outbox";
import { useChatTranslation } from "@/hooks/useChatTranslation";
import { ChatTranslationControls } from "@/components/chat/ChatTranslationControls";
import { ChatPolls } from "@/components/chat/ChatPolls";
import { playChatEmojiSound, CHAT_EMOJI_SOUND_KEY } from "@/lib/chat-emoji";
import { CallHistoryDialog } from "@/components/chat/CallHistoryDialog";

type Story = Tables<"stories"> & { profile?: Tables<"profiles"> };
type MessageMetadata = { read_at?: string | null; is_read?: boolean | null; delivered_at?: string | null; reply_to_id?: string | null };
type StoryMetadata = Story & { music_url?: string | null; media_type?: string | null; text_overlay?: { text?: string; text_color?: string; text_background?: string; text_font?: string; text_size?: number; sticker?: string; music_title?: string; music_start?: number; music_end?: number; image_filter?: string; drawing_url?: string } | null; duration?: number | null };

const HIDDEN_CHATS_STORAGE_KEY = "tigerchats:hidden-chats";
const FAVORITE_CHATS_STORAGE_KEY = "tigerchats:favorite-chats";
type ChatFilter = "all" | "unread" | "groups" | "favorites";

const readFavoriteChats = (): string[] => {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(FAVORITE_CHATS_STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter((id): id is string => typeof id === "string") : [];
  } catch { return []; }
};

const readHiddenChatMap = (): Record<string, number> => {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(HIDDEN_CHATS_STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
};

const Chats = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [params, setParams] = useSearchParams();
  const activeChat = params.get("c");
  const setActiveChat = (id: string | null) => {
    if (id) setParams({ c: id });
    else setParams({});
  };

  const [search, setSearch] = useState("");
  const [chatFilter, setChatFilter] = useState<ChatFilter>("all");
  const [favoriteChats, setFavoriteChats] = useState<string[]>(() => readFavoriteChats());
  const [stories, setStories] = useState<Story[]>([]);
  const [storyViewerIndex, setStoryViewerIndex] = useState<number | null>(null);
  const webrtc = useCall();
  const [replyTo, setReplyTo] = useState<Message | null>(null);
  const [editingMessage, setEditingMessage] = useState<Message | null>(null);
  const [forwardMsg, setForwardMsg] = useState<{ content: string; type: string; mediaUrl?: string } | null>(null);
  const [hiddenChats, setHiddenChats] = useState<Record<string, number>>(() => readHiddenChatMap());
  const [showArchivedChats, setShowArchivedChats] = useState(false);
  const [customizationOpen, setCustomizationOpen] = useState(false);
  const [inviteMembersOpen, setInviteMembersOpen] = useState(false);
  const [groupSettingsOpen, setGroupSettingsOpen] = useState(false);
  const [callHistoryOpen, setCallHistoryOpen] = useState(false);

  const [chatSearchOpen, setChatSearchOpen] = useState(false);
  const [chatSearch, setChatSearch] = useState("");
  const [matchIdx, setMatchIdx] = useState(0);
  const [queuedForActiveChat, setQueuedForActiveChat] = useState<QueuedMessage[]>([]);

  useEffect(() => {
    const update = () => {
      if (activeChat) {
        setQueuedForActiveChat(getQueuedMessages(activeChat));
      } else {
        setQueuedForActiveChat([]);
      }
    };
    update();
    const unsubscribe = subscribeOutbox(update);
    return () => { unsubscribe(); };
  }, [activeChat]);

  const lastEmojiSoundMessageRef = useRef<string | null>(null);
  const lastEmojiSoundConversationRef = useRef<string | null>(activeChat);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesScrollRef = useRef<HTMLDivElement>(null);

  const { conversations, loading: convosLoading, refetch: refetchConversations } = useConversations();
  const { messages, deleteMessage } = useMessages(activeChat);
  const { reactions, pinnedMessages, toggleReaction, togglePin, editMessage } = useChatMessageFeatures(activeChat, user?.id);
  const { typingUsers, notifyTyping } = useTypingIndicator(activeChat);
  useReadReceipts(activeChat, !!activeChat);
  useScreenshotProtection(!!activeChat);
  const { prefs: chatPrefs } = useChatPreferences(activeChat);

  useEffect(() => {
    if (typeof window !== "undefined") {
      window.localStorage.setItem(HIDDEN_CHATS_STORAGE_KEY, JSON.stringify(hiddenChats));
    }
  }, [hiddenChats]);

  useEffect(() => {
    if (typeof window !== "undefined") window.localStorage.setItem(FAVORITE_CHATS_STORAGE_KEY, JSON.stringify(favoriteChats));
  }, [favoriteChats]);

  const toggleFavoriteChat = (conversationId: string) => {
    setFavoriteChats((current) => current.includes(conversationId) ? current.filter((id) => id !== conversationId) : [...current, conversationId]);
  };

  useEffect(() => {
    if (!activeChat || !hiddenChats[activeChat]) return;
    setActiveChat(null);
  }, [activeChat, hiddenChats]);

  useEffect(() => {
    const fetchStories = async () => {
      const { data } = await supabase.from("stories").select("*").order("created_at", { ascending: false });
      if (data) {
        const enriched = await Promise.all(
          data.map(async (story) => {
            const { data: profile } = await supabase.from("profiles").select("*").eq("user_id", story.user_id).single();
            return { ...story, profile };
          })
        );
        setStories(enriched);
      }
    };
    fetchStories();
  }, []);

  useEffect(() => {
    if (!chatSearchOpen) messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, chatSearchOpen]);

  useEffect(() => {
    const newest = messages[messages.length - 1];
    if (!newest) return;
    if (lastEmojiSoundConversationRef.current !== activeChat) {
      lastEmojiSoundConversationRef.current = activeChat;
      lastEmojiSoundMessageRef.current = newest.id;
      return;
    }
    if (lastEmojiSoundMessageRef.current === null) { lastEmojiSoundMessageRef.current = newest.id; return; }
    if (lastEmojiSoundMessageRef.current !== newest.id) {
      lastEmojiSoundMessageRef.current = newest.id;
      const isIncoming = newest.sender_id !== user?.id;
      const content = newest.content || "";
      const emojiOnly = /^(?:\p{Extended_Pictographic}|\uFE0F|\u200D|\s)+$/u.test(content.trim()) && Array.from(content.trim()).length <= 8;
      if (isIncoming && emojiOnly && localStorage.getItem(CHAT_EMOJI_SOUND_KEY) !== "false") playChatEmojiSound(content.trim());
    }
  }, [messages, user?.id, activeChat]);

  useEffect(() => {
    setChatSearchOpen(false);
    setChatSearch("");
    setReplyTo(null);
    setEditingMessage(null);
  }, [activeChat]);

  const handleSend = async (text: string) => {
    if (!activeChat || !user || !text.trim()) return;
    if (editingMessage) {
      const { error } = await editMessage(editingMessage.id, text.trim());
      if (error) toast({ title: "Edit failed", description: error.message, variant: "destructive" });
      else toast({ title: "Message updated" });
      setEditingMessage(null);
      return;
    }

    // Queue first for both online and offline sends. The outbox uses one stable
    // message UUID, so a lost network response cannot create a duplicate.
    enqueueMessage({
      conversationId: activeChat,
      senderId: user.id,
      content: text.trim(),
      messageType: "text",
      replyToId: replyTo?.id || null,
    });
    setReplyTo(null);
    toast({
      title: typeof navigator !== "undefined" && !navigator.onLine
        ? "Ujumbe umehifadhiwa (Offline)"
        : "Ujumbe umewekwa kwenye foleni ya kutumwa",
      description: "TigerChat itathibitisha utumaji na kujaribu tena mtandao ukirudi.",
    });
  };

  const handleSendVoice = async (blob: Blob, duration: number) => {
    if (!activeChat || !user) return;
    const filePath = `${user.id}/${Date.now()}.webm`;
    const { error: uploadError } = await supabase.storage.from("chat-media").upload(filePath, blob);
    if (uploadError) return toast({ title: "Upload failed", description: uploadError.message, variant: "destructive" });
    const { data: { publicUrl } } = supabase.storage.from("chat-media").getPublicUrl(filePath);
    const mins = Math.floor(duration / 60);
    const secs = duration % 60;
    const { error } = await supabase.from("messages").insert({
      conversation_id: activeChat,
      sender_id: user.id,
      content: `${mins}:${secs.toString().padStart(2, "0")}`,
      message_type: "voice",
      media_url: publicUrl,
      reply_to_id: replyTo?.id || null,
    });
    if (error) {
      toast({ title: "Voice message failed", description: error.message, variant: "destructive" });
      return;
    }
    setReplyTo(null);
    void dispatchPush(activeChat);
  };

  const handleSendFile = async (file: File) => {
    if (!activeChat || !user) return;
    const ext = file.name.split(".").pop();
    const filePath = `${user.id}/${Date.now()}.${ext}`;
    const { error: uploadError } = await supabase.storage.from("chat-media").upload(filePath, file);
    if (uploadError) return toast({ title: "Upload failed", description: uploadError.message, variant: "destructive" });
    const { data: { publicUrl } } = supabase.storage.from("chat-media").getPublicUrl(filePath);
    const msgType = file.type.startsWith("image/") ? "image" : "file";
    const { error } = await supabase.from("messages").insert({
      conversation_id: activeChat,
      sender_id: user.id,
      content: msgType === "image" ? "" : file.name,
      message_type: msgType,
      media_url: publicUrl,
      reply_to_id: replyTo?.id || null,
    });
    if (error) {
      toast({ title: "Attachment failed", description: error.message, variant: "destructive" });
      return;
    }
    setReplyTo(null);
    void dispatchPush(activeChat);
  };

  const handleHideChat = (conversationId: string) => {
    setHiddenChats((prev) => ({ ...prev, [conversationId]: Date.now() }));
    if (activeChat === conversationId) setActiveChat(null);
  };

  const handleExitGroup = async () => {
    if (!activeConvo || !user || activeConvo.type !== "group") return;
    const confirmed = window.confirm("Exit this group? You will no longer receive its messages unless you are added again.");
    if (!confirmed) return;

    // Remove the user's admin role first, then their group membership.
    const { error: adminError } = await supabase
      .from("group_admins")
      .delete()
      .eq("conversation_id", activeConvo.id)
      .eq("user_id", user.id);
    if (adminError) {
      toast({ title: "Could not exit group", description: adminError.message, variant: "destructive" });
      return;
    }

    const { data, error } = await supabase
      .from("conversation_members")
      .delete()
      .eq("conversation_id", activeConvo.id)
      .eq("user_id", user.id)
      .select("user_id")
      .maybeSingle();

    if (error || !data) {
      toast({
        title: "Could not exit group",
        description: error?.message || "Your group membership could not be removed.",
        variant: "destructive",
      });
      return;
    }

    setHiddenChats((prev) => {
      const next = { ...prev };
      delete next[activeConvo.id];
      return next;
    });
    setActiveChat(null);
    await refetchConversations();
    toast({ title: "You left the group" });
  };

  const handleDeleteChat = async (mode: "me" | "everyone") => {
    if (!activeChat || !user) return;
    const confirmed = mode === "everyone"
      ? window.confirm("Delete this conversation for everyone? All members will lose access to its messages. This cannot be undone.")
      : window.confirm("Delete this conversation for you? Other members will still see it.");
    if (!confirmed) return;

    const result = mode === "everyone"
      ? await supabase.from("conversations").delete().eq("id", activeChat).select("id").maybeSingle()
      : await supabase.from("conversation_members").delete()
          .eq("conversation_id", activeChat).eq("user_id", user.id).select("id").maybeSingle();

    if (result.error || !result.data) {
      toast({
        title: "Chat deletion failed",
        description: result.error?.message || "You may not have permission to delete this chat.",
        variant: "destructive",
      });
      return;
    }

    setHiddenChats((prev) => {
      const next = { ...prev };
      delete next[activeChat];
      return next;
    });
    setActiveChat(null);
    await refetchConversations();
    toast({ title: mode === "everyone" ? "Chat deleted for everyone" : "Chat deleted for you" });
  };

  const handleDeleteMessage = async (messageId: string, mode: "me" | "everyone" = "everyone") => {
    if (messageId.startsWith("queued_")) {
      removeQueuedMessage(messageId);
      toast({ title: "Ujumbe umeondolewa kwenye foleni" });
      return;
    }
    const { error } = await deleteMessage(messageId, mode);
    if (error) toast({ title: "Delete failed", description: error.message, variant: "destructive" });
  };

  const messageMap = new Map<string, Message>();
  const uiMessages = messages.map((msg) => {
    const metadata = msg as typeof msg & MessageMetadata;
    const status: Message["status"] = metadata.read_at || metadata.is_read
      ? "read"
      : metadata.delivered_at
      ? "delivered"
      : "sent";

    const m: Message = {
      id: msg.id,
      senderId: msg.sender_id === user?.id ? "me" : msg.sender_id,
      text: msg.content || "",
      time: new Date(msg.created_at!).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      status,
      type: msg.message_type as Message["type"],
      mediaUrl: msg.media_url || undefined,
      statusContext: msg.status_context && typeof msg.status_context === "object" && !Array.isArray(msg.status_context) && typeof msg.status_context.caption === "string" && typeof msg.status_context.story_id === "string" ? { caption: msg.status_context.caption, story_id: msg.status_context.story_id } : undefined,
    };

    messageMap.set(msg.id, m);
    return { ui: m, replyToId: metadata.reply_to_id ?? null };
  });

  const queuedUiList = queuedForActiveChat.map((q) => {
    const m: Message = {
      id: q.id,
      senderId: "me",
      text: q.content,
      time: new Date(q.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      status: "pending",
      type: (q.messageType || "text") as Message["type"],
      mediaUrl: q.mediaUrl || undefined,
    };
    messageMap.set(q.id, m);
    return { ui: m, replyToId: q.replyToId ?? null };
  });

  const allUiMessages = [...uiMessages, ...queuedUiList];

  const translation = useChatTranslation(user?.id, activeChat, allUiMessages.map(item => item.ui));

  const matchIds = useMemo(() => {
    const q = chatSearch.trim().toLowerCase();
    if (!q) return [] as string[];
    return allUiMessages.filter(({ ui }) => ui.text.toLowerCase().includes(q)).map(({ ui }) => ui.id);
  }, [chatSearch, uiMessages]);

  useEffect(() => { setMatchIdx(0); }, [chatSearch]);

  useEffect(() => {
    if (!matchIds.length) return;
    const id = matchIds[matchIdx];
    const el = document.querySelector(`[data-msg-id="${id}"]`);
    if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [matchIdx, matchIds]);

  const activeConvo = conversations.find((c) => c.id === activeChat);
  const filteredConversations = conversations.filter((c) => {
    const name = c.otherProfile?.display_name || c.name || "";
    const query = search.trim().toLowerCase();
    const matchesSearch = !query || name.toLowerCase().includes(query) || (c.lastMessage?.content || "").toLowerCase().includes(query);
    const matchesFilter = chatFilter === "all" || (chatFilter === "unread" && c.unreadCount > 0) || (chatFilter === "groups" && c.type === "group") || (chatFilter === "favorites" && favoriteChats.includes(c.id));
    return matchesSearch && matchesFilter;
  });
  const visibleConversations = filteredConversations.filter((c) => !hiddenChats[c.id]);
  const hiddenConversations = filteredConversations.filter((c) => !!hiddenChats[c.id]);

  const storyBarData = [
    { id: "add", userId: "me", userName: "Your Story", avatar: "➕", viewed: false },
    ...stories.map((s) => ({
      id: s.id,
      userId: s.user_id,
      userName: s.profile?.display_name || "User",
      avatar: (s.profile?.display_name || "U").slice(0, 2).toUpperCase(),
      viewed: false,
    })),
  ];

  const storyViewerData = stories.map((s) => {
    const metadata = s as typeof s & {
      music_url?: string | null;
      media_type?: string | null;
      text_overlay?: { text: string } | null;
      duration?: number | null;
      background_color?: string | null;
    };
    return {
      id: s.id,
      userId: s.user_id,
      userName: s.profile?.display_name || "User",
      avatar: (s.profile?.display_name || "U").slice(0, 2).toUpperCase(),
      imageUrl: s.image_url || undefined,
      caption: s.caption || undefined,
      musicUrl: metadata.music_url || undefined,
      mediaType: (metadata.media_type || "image") as "image" | "video" | "text",
      textOverlay: metadata.text_overlay || null,
      duration: metadata.duration || null,
      backgroundColor: metadata.background_color || "#6D28D9",
    };
  });

  const activeConvoName = activeConvo?.otherProfile?.display_name || activeConvo?.name || "Chat";
  const activeConvoAvatar = (activeConvo?.otherProfile?.display_name || "C").slice(0, 2).toUpperCase();
  const isGroup = activeConvo?.type === "group";
  const isTyping = typingUsers.length > 0;

  const handleStartCall = (isVideo: boolean) => {
    if (!activeConvo || !activeConvo.otherProfile?.user_id) return;
    webrtc.startCall(
      activeConvo.otherProfile.user_id,
      activeConvo.id,
      isVideo ? "video" : "voice",
      activeConvoName,
      activeConvoAvatar,
    );
  };

  const showSidebar = !activeChat;
  const matchSet = new Set(matchIds);
  const activeMatchId = matchIds[matchIdx];

  return (
    <div className="h-full flex overflow-hidden bg-background">
      {callHistoryOpen && <CallHistoryDialog onClose={() => setCallHistoryOpen(false)} onOpenConversation={(conversationId) => { setCallHistoryOpen(false); setActiveChat(conversationId); }} />}

      {storyViewerIndex !== null && storyViewerData.length > 0 && (
        <StoryViewer stories={storyViewerData} initialIndex={storyViewerIndex} onClose={() => setStoryViewerIndex(null)} onStoryDeleted={(storyId) => setStories(current => current.filter(item => item.id !== storyId))} currentUserId={user?.id} />
      )}

      {forwardMsg && (
        <ForwardDialog open={!!forwardMsg} onClose={() => setForwardMsg(null)} messageContent={forwardMsg.content} messageType={forwardMsg.type} mediaUrl={forwardMsg.mediaUrl} />
      )}

      <div className={`${showSidebar ? "flex" : "hidden"} md:flex flex-col w-full md:w-[380px] lg:w-[420px] border-r border-border/50 bg-card/50`}>
        <div className="flex items-center justify-between px-4 py-3 border-b border-border/50">
          <div className="flex items-center gap-2.5">
            <img src={tigerLogo} alt="TIGERCHATS" className="w-9 h-9" width={512} height={512} />
            <h1 className="text-lg font-bold tracking-tight text-foreground">TIGER<span className="text-primary">CHATS</span></h1>
          </div>
          <div className="flex items-center gap-1">
            <button type="button" onClick={() => setCallHistoryOpen(true)} className="p-2 rounded-full hover:bg-surface-hover text-muted-foreground" title="Call history" aria-label="Call history"><Phone className="w-4 h-4" /></button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="p-2 rounded-full hover:bg-surface-hover text-muted-foreground" title="Chat list settings" aria-label="Chat list settings"><MoreVertical className="w-4 h-4" /></button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onSelect={() => setShowArchivedChats((value) => !value)}>
                  <Archive className="w-4 h-4 mr-2" /> {showArchivedChats ? "Back to chats" : `Archived chats (${hiddenConversations.length})`}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <NewDmDialog onStarted={(id) => { setActiveChat(id); refetchConversations(); }} />
            <NewGroupDialog onCreated={(id) => { if (id) setActiveChat(id); void refetchConversations(); }} />
            <StoryUploadDialog onUploaded={() => {
              supabase.from("stories").select("*").order("created_at", { ascending: false }).then(async ({ data }) => {
                if (data) {
                  const enriched = await Promise.all(data.map(async (story) => {
                    const { data: profile } = await supabase.from("profiles").select("*").eq("user_id", story.user_id).single();
                    return { ...story, profile };
                  }));
                  setStories(enriched);
                }
              });
            }} />
          </div>
        </div>

        <div className="px-4 py-2">
          <div className="flex items-center gap-2 bg-surface rounded-xl px-3 py-2">
            <Search className="w-4 h-4 text-muted-foreground" />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search chats..." className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground outline-none" />
          </div>
        </div>

        <div className="flex items-center gap-2 overflow-x-auto px-4 pb-2 pt-1 scrollbar-thin" role="group" aria-label="Filter chats">
          {([{ id: "all", label: "All" }, { id: "unread", label: "Unread" }, { id: "groups", label: "Groups" }, { id: "favorites", label: "Favorites" }] as const).map((filter) => (
            <button key={filter.id} type="button" onClick={() => { setChatFilter(filter.id); setShowArchivedChats(false); }} aria-pressed={chatFilter === filter.id} className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${chatFilter === filter.id ? "bg-primary text-primary-foreground shadow-sm" : "bg-surface text-muted-foreground hover:text-foreground hover:bg-surface-hover"}`}>{filter.label}{filter.id === "unread" && conversations.some((item) => item.unreadCount > 0) ? <span className="ml-1.5 opacity-80">•</span> : null}</button>
          ))}
        </div>

        <StoriesBar stories={storyBarData} onStoryClick={(index) => setStoryViewerIndex(index)} onAddStory={() => {}} />

        <div className="flex-1 overflow-y-auto scrollbar-thin">
          {convosLoading ? (
            <div className="flex items-center justify-center py-20"><div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" /></div>
          ) : showArchivedChats ? (
            hiddenConversations.length === 0 ? (
              <div className="text-center py-16 px-4 text-sm text-muted-foreground">No archived chats</div>
            ) : (
              <div className="divide-y divide-border/40">
                {hiddenConversations.map((convo) => (
                  <div key={convo.id} className="flex items-center gap-3 px-4 py-3">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-foreground truncate">{convo.otherProfile?.display_name || convo.name || "Chat"}</p>
                      <p className="text-xs text-muted-foreground truncate">{convo.lastMessage?.content || "No messages yet"}</p>
                    </div>
                    <button onClick={() => setHiddenChats((prev) => { const next = { ...prev }; delete next[convo.id]; return next; })} className="inline-flex items-center gap-1 rounded-lg px-3 py-2 text-xs font-medium text-primary hover:bg-primary/10" aria-label={`Restore ${convo.otherProfile?.display_name || convo.name || "chat"}`}><RotateCcw className="w-3.5 h-3.5" /> Restore</button>
                  </div>
                ))}
              </div>
            )
          ) : visibleConversations.length === 0 ? (
            <div className="text-center py-20 px-4">
              <MessageCircle className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
              <p className="text-sm text-muted-foreground">No conversations yet</p>
              <p className="text-xs text-muted-foreground mt-1">Tap the ✏️ icon to start a new chat!</p>
            </div>
          ) : (
            visibleConversations.map((convo) => (
              <ChatListItem
                key={convo.id}
                contact={{
                  id: convo.id,
                  name: convo.otherProfile?.display_name || convo.name || "Chat",
                  avatar: (convo.otherProfile?.display_name || "C").slice(0, 2).toUpperCase(),
                  lastMessage: convo.lastMessage?.content || "No messages yet",
                  time: convo.lastMessage ? new Date(convo.lastMessage.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "",
                  unread: convo.unreadCount,
                  online: convo.otherProfile?.is_online || false,
                }}
                isActive={activeChat === convo.id}
                onClick={() => setActiveChat(convo.id)}
              />
            ))
          )}
        </div>
      </div>

      <div className={`${!showSidebar ? "flex" : "hidden"} md:flex flex-1 min-w-0 flex-col`}>
        {activeConvo ? (
          <div className="flex flex-col h-full">
            <div className="flex items-center gap-3 px-4 py-3 glass border-b border-border/50">
              <button onClick={() => setActiveChat(null)} className="md:hidden p-1 hover:bg-surface-hover rounded-full transition-colors"><ArrowLeft className="w-5 h-5 text-foreground" /></button>
              <div className="relative">
                <div className="w-10 h-10 rounded-full bg-secondary flex items-center justify-center text-sm font-semibold text-secondary-foreground">{activeConvoAvatar}</div>
                {activeConvo.otherProfile?.is_online && <div className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full bg-primary border-2 border-background" />}
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-semibold text-sm text-foreground">{activeConvoName}</h3>
                <p className="text-[11px] text-muted-foreground">
                  {isTyping ? <span className="text-primary animate-pulse">typing...</span> : isGroup ? <span>Group</span> : activeConvo.otherProfile?.is_online ? <span className="text-primary">online</span> : "last seen recently"}
                </p>
              </div>
              <div className="flex items-center gap-1">
                <button onClick={() => handleStartCall(false)} className="p-2 rounded-full hover:bg-surface-hover transition-colors text-muted-foreground hover:text-primary" title="Voice call" aria-label="Voice call"><Phone className="w-4 h-4" /></button>
                <button onClick={() => handleStartCall(true)} className="p-2 rounded-full hover:bg-surface-hover transition-colors text-muted-foreground hover:text-primary" title="Video call" aria-label="Video call"><Video className="w-4 h-4" /></button>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button className="p-2 rounded-full hover:bg-surface-hover transition-colors text-muted-foreground hover:text-primary" title="Chat options" aria-label="Chat options"><MoreVertical className="w-4 h-4" /></button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="min-w-56">
                    <DropdownMenuItem onSelect={() => setChatSearchOpen((o) => !o)}>
                      <Search className="w-4 h-4 mr-2" /> Search messages
                    </DropdownMenuItem>
                    {isGroup && <>
                      <DropdownMenuItem onSelect={() => setInviteMembersOpen(true)}>
                        <UserPlus className="w-4 h-4 mr-2" /> Add members
                      </DropdownMenuItem>
                      <DropdownMenuItem onSelect={() => setGroupSettingsOpen(true)}>
                        <Settings className="w-4 h-4 mr-2" /> Group settings
                      </DropdownMenuItem>
                    </>}
                    <DropdownMenuItem onSelect={() => setCustomizationOpen(true)}>
                      <Palette className="w-4 h-4 mr-2" /> Chat theme
                    </DropdownMenuItem>
                    <DropdownMenuSub>
                      <DropdownMenuSubTrigger>
                        <MoreVertical className="w-4 h-4 mr-2" /> More
                      </DropdownMenuSubTrigger>
                      <DropdownMenuSubContent>
                        {isGroup && (
                          <DropdownMenuItem className="text-destructive focus:text-destructive" onSelect={() => void handleExitGroup()}>
                            <LogOut className="w-4 h-4 mr-2" /> Exit group
                          </DropdownMenuItem>
                        )}
                        <DropdownMenuItem onSelect={() => handleHideChat(activeConvo.id)}>
                          <EyeOff className="w-4 h-4 mr-2" /> Hide chat
                        </DropdownMenuItem>
                        <DropdownMenuItem onSelect={() => void handleDeleteChat("me")}>
                          <Trash2 className="w-4 h-4 mr-2" /> Delete for me
                        </DropdownMenuItem>
                        <DropdownMenuItem className="text-destructive focus:text-destructive" onSelect={() => void handleDeleteChat("everyone")}>
                          <Trash2 className="w-4 h-4 mr-2" /> Delete for everyone
                        </DropdownMenuItem>
                      </DropdownMenuSubContent>
                    </DropdownMenuSub>
                  </DropdownMenuContent>
                </DropdownMenu>
                {isGroup && <>
                  <InviteMembersDialog conversationId={activeConvo.id} existingMemberIds={[user?.id || ""]} onInvited={() => refetchConversations()} open={inviteMembersOpen} onOpenChange={setInviteMembersOpen} hideTrigger />
                  <GroupAdminDialog conversationId={activeConvo.id} open={groupSettingsOpen} onOpenChange={setGroupSettingsOpen} hideTrigger />
                </>}
                <ChatCustomizationDialog conversationId={activeConvo.id} open={customizationOpen} onOpenChange={setCustomizationOpen} hideTrigger />
              </div>
            </div>

            <ChatTranslationControls language={translation.language} onChange={translation.setLanguage} loading={translation.loading} error={translation.error} onRetry={translation.retry} />
            {activeChat && user && <ChatPolls conversationId={activeChat} userId={user.id} />}
            {pinnedMessages.length > 0 && <div className="flex items-center gap-2 overflow-x-auto border-b border-border/40 bg-primary/5 px-3 py-2">{pinnedMessages.slice(0, 3).map((item) => <button key={item.id} type="button" onClick={() => document.querySelector(`[data-msg-id="${item.message_id}"]`)?.scrollIntoView({ behavior: "smooth", block: "center" })} className="flex min-w-0 max-w-[220px] items-center gap-1.5 rounded-full border border-primary/20 bg-background/70 px-3 py-1.5 text-left text-[11px] hover:bg-primary/10"><span className="shrink-0">📌</span><span className="truncate">{item.content || (item.message_type === "image" ? "Photo" : "Pinned message")}</span></button>)}</div>}

            {chatSearchOpen && (
              <div className="flex items-center gap-2 px-4 py-2 border-b border-border/50 bg-card/80">
                <Search className="w-4 h-4 text-muted-foreground" />
                <input autoFocus value={chatSearch} onChange={(e) => setChatSearch(e.target.value)} placeholder="Search in conversation..." className="flex-1 bg-transparent text-sm outline-none text-foreground placeholder:text-muted-foreground" />
                {chatSearch && <span className="text-[11px] text-muted-foreground tabular-nums">{matchIds.length === 0 ? "0" : `${matchIdx + 1}/${matchIds.length}`}</span>}
                <button onClick={() => setMatchIdx((i) => (matchIds.length ? (i - 1 + matchIds.length) % matchIds.length : 0))} disabled={!matchIds.length} className="p-1 text-muted-foreground hover:text-foreground disabled:opacity-30"><ChevronUp className="w-4 h-4" /></button>
                <button onClick={() => setMatchIdx((i) => (matchIds.length ? (i + 1) % matchIds.length : 0))} disabled={!matchIds.length} className="p-1 text-muted-foreground hover:text-foreground disabled:opacity-30"><ChevronDown className="w-4 h-4" /></button>
                <button onClick={() => { setChatSearchOpen(false); setChatSearch(""); }} className="p-1 text-muted-foreground hover:text-foreground"><X className="w-4 h-4" /></button>
              </div>
            )}

            <div ref={messagesScrollRef} className={`flex-1 min-w-0 overflow-y-auto overflow-x-hidden scrollbar-thin p-4 space-y-1 relative ${wallpaperClass(chatPrefs.wallpaper)} ${fontSizeClass(chatPrefs.font_size)}`}>
              {(!chatPrefs.wallpaper || chatPrefs.wallpaper === "default") && <TigerChatBackground />}
              {allUiMessages.map(({ ui, replyToId }) => {
                const isMatch = matchSet.has(ui.id);
                const isActive = ui.id === activeMatchId;
                return (
                  <div key={ui.id} data-msg-id={ui.id} className={isActive ? "rounded-lg ring-2 ring-primary ring-offset-2 ring-offset-background transition-all" : isMatch ? "rounded-lg ring-1 ring-primary/40 transition-all" : ""}>
                    <MessageBubble message={ui} translatedText={translation.translations[ui.id]} replyMessage={replyToId ? messageMap.get(replyToId) || null : null} onReply={(msg) => setReplyTo(msg)} onForward={(msg) => setForwardMsg({ content: msg.text, type: msg.type, mediaUrl: msg.mediaUrl })} onDelete={handleDeleteMessage} onStatusClick={(storyId) => { const index = storyViewerData.findIndex(item => item.id === storyId); if (index >= 0) setStoryViewerIndex(index); else toast({ title: "Status haipatikani", description: "Huenda muda wake wa saa 24 umeisha." }); }} reactions={reactions[ui.id] || []} isPinned={pinnedMessages.some((item) => item.message_id === ui.id)} onReact={async (emoji) => { const result = await toggleReaction(ui.id, emoji); if (result.error) toast({ title: "Reaction failed", description: result.error.message, variant: "destructive" }); }} onTogglePin={async () => { const result = await togglePin(ui.id); if (result.error) toast({ title: "Pin update failed", description: result.error.message, variant: "destructive" }); }} onEdit={() => setEditingMessage(ui)} isEdited={Boolean((messages.find((item) => item.id === ui.id) as (typeof messages[number] & { is_edited?: boolean }) | undefined)?.is_edited)} myBubbleClass={bubbleColorClass(chatPrefs.bubble_color)} />
                  </div>
                );
              })}
              <div ref={messagesEndRef} />
            </div>

            {queuedForActiveChat.length > 0 && (
              <div className="flex items-center justify-between px-4 py-1.5 bg-amber-500/10 border-t border-amber-500/25 text-amber-300 text-xs">
                <div className="flex items-center gap-2 truncate">
                  <Clock className="w-3.5 h-3.5 text-amber-400 shrink-0 animate-pulse" />
                  <span>
                    {queuedForActiveChat.length} {queuedForActiveChat.length === 1 ? "ujumbe upo" : "jumbe zipo"} kwenye foleni ya kutumwa mtandao ukirudi
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => void processOutbox(true)}
                  className="px-2.5 py-0.5 rounded bg-amber-500/20 hover:bg-amber-500/30 text-amber-200 text-[11px] font-medium transition-colors ml-2 shrink-0"
                >
                  Tuma sasa
                </button>
              </div>
            )}
            <MessageInput onSend={handleSend} onSendVoice={handleSendVoice} onSendFile={handleSendFile} onTyping={notifyTyping} replyTo={replyTo} onCancelReply={() => setReplyTo(null)} editingMessage={editingMessage} onCancelEdit={() => setEditingMessage(null)} />
          </div>
        ) : activeChat && convosLoading ? (
          <div className="flex-1 flex flex-col items-center justify-center gap-3 text-center p-8">
            <div className="w-7 h-7 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            <p className="text-sm text-muted-foreground">Opening conversation...</p>
          </div>
        ) : activeChat ? (
          <div className="flex-1 flex flex-col items-center justify-center gap-3 text-center p-8">
            <MessageCircle className="w-12 h-12 text-muted-foreground" />
            <h2 className="text-lg font-semibold text-foreground">Conversation unavailable</h2>
            <p className="text-sm text-muted-foreground max-w-sm">This conversation could not be loaded. Return to your chat list and try again.</p>
            <button type="button" onClick={() => setActiveChat(null)} className="rounded-full bg-primary px-4 py-2 text-sm font-medium text-primary-foreground">Back to chats</button>
          </div>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center gap-4 text-center p-8">
            <img src={tigerLogo} alt="TIGERCHATS" className="w-24 h-24 opacity-30" width={512} height={512} />
            <div>
              <h2 className="text-xl font-bold text-foreground mb-1">Welcome to <span className="text-primary">TIGERCHATS</span></h2>
              <p className="text-sm text-muted-foreground max-w-sm">Select a chat to start messaging.</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Chats;
