import { useState, useEffect, useRef, useMemo } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useConversations, useMessages } from "@/hooks/useChat";
import { useTypingIndicator } from "@/hooks/useTypingIndicator";
import { useNotifications } from "@/hooks/useNotifications";
import { StoriesBar } from "@/components/chat/StoriesBar";
import { ChatListItem } from "@/components/chat/ChatListItem";
import { MessageBubble } from "@/components/chat/MessageBubble";
import { MessageInput } from "@/components/chat/MessageInput";
import { StoryViewer } from "@/components/chat/StoryViewer";
import { CallDialog } from "@/components/chat/CallDialog";
import { useWebRTC } from "@/hooks/useWebRTC";
import { useReadReceipts } from "@/hooks/useReadReceipts";
import { TigerChatBackground } from "@/components/chat/TigerChatBackground";
import { InviteMembersDialog } from "@/components/chat/InviteMembersDialog";
import { ForwardDialog } from "@/components/chat/ForwardDialog";
import { GroupAdminDialog } from "@/components/chat/GroupAdminDialog";
import { ChatCustomizationDialog, wallpaperClass, bubbleColorClass, fontSizeClass } from "@/components/chat/ChatCustomizationDialog";
import { useChatPreferences } from "@/hooks/useChatPreferences";
import { NewDmDialog } from "@/components/chat/NewDmDialog";
import { NewGroupDialog } from "@/components/chat/NewGroupDialog";
import { StoryUploadDialog } from "@/components/chat/StoryUploadDialog";
import { Search, MessageCircle, ArrowLeft, Phone, Video, MoreVertical, X, ChevronUp, ChevronDown } from "lucide-react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";
import { Tables } from "@/integrations/supabase/types";
import { Message } from "@/types/chat";
import tigerLogo from "@/assets/tigerchats-logo.png";

type Story = Tables<"stories"> & { profile?: Tables<"profiles"> };

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
  const [stories, setStories] = useState<Story[]>([]);
  const [storyViewerIndex, setStoryViewerIndex] = useState<number | null>(null);
  const webrtc = useWebRTC();
  const [replyTo, setReplyTo] = useState<Message | null>(null);
  const [forwardMsg, setForwardMsg] = useState<{ content: string; type: string; mediaUrl?: string } | null>(null);

  // In-chat message search
  const [chatSearchOpen, setChatSearchOpen] = useState(false);
  const [chatSearch, setChatSearch] = useState("");
  const [matchIdx, setMatchIdx] = useState(0);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesScrollRef = useRef<HTMLDivElement>(null);
  

  const { conversations, loading: convosLoading, refetch: refetchConversations } = useConversations();
  const { messages } = useMessages(activeChat);
  const { typingUsers, notifyTyping } = useTypingIndicator(activeChat);
  useNotifications();
  useReadReceipts(activeChat, !!activeChat);
  const { prefs: chatPrefs } = useChatPreferences(activeChat);

  useEffect(() => {
    const fetchStories = async () => {
      const { data } = await supabase.from("stories").select("*").order("created_at", { ascending: false });
      if (data) {
        const enriched = await Promise.all(
          data.map(async (story) => {
            const { data: profile } = await supabase
              .from("profiles")
              .select("*")
              .eq("user_id", story.user_id)
              .single();
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

  // Reset search on chat change
  useEffect(() => {
    setChatSearchOpen(false);
    setChatSearch("");
    setReplyTo(null);
  }, [activeChat]);

  const handleSend = async (text: string) => {
    if (!activeChat || !user) return;
    const replyId = replyTo?.id;
    setReplyTo(null);
    await supabase.from("messages").insert({
      conversation_id: activeChat,
      sender_id: user.id,
      content: text,
      message_type: "text",
      reply_to_id: replyId || null,
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
    await supabase.from("messages").insert({
      conversation_id: activeChat,
      sender_id: user.id,
      content: `${mins}:${secs.toString().padStart(2, "0")}`,
      message_type: "voice",
      media_url: publicUrl,
    });
  };

  const handleSendFile = async (file: File) => {
    if (!activeChat || !user) return;
    const ext = file.name.split(".").pop();
    const filePath = `${user.id}/${Date.now()}.${ext}`;
    const { error: uploadError } = await supabase.storage.from("chat-media").upload(filePath, file);
    if (uploadError) return toast({ title: "Upload failed", description: uploadError.message, variant: "destructive" });
    const { data: { publicUrl } } = supabase.storage.from("chat-media").getPublicUrl(filePath);
    const msgType = file.type.startsWith("image/") ? "image" : "file";
    await supabase.from("messages").insert({
      conversation_id: activeChat,
      sender_id: user.id,
      content: msgType === "image" ? "" : file.name,
      message_type: msgType,
      media_url: publicUrl,
    });
  };

  const handleDeleteMessage = async (messageId: string) => {
    const { error } = await supabase.from("messages").delete().eq("id", messageId);
    if (error) toast({ title: "Delete failed", description: error.message, variant: "destructive" });
  };


  const messageMap = new Map<string, Message>();
  const uiMessages = messages.map((msg) => {
    const anyMsg = msg as any;
    const status: Message["status"] = anyMsg.read_at
      ? "read"
      : anyMsg.delivered_at
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
    };
    messageMap.set(msg.id, m);
    return { ui: m, replyToId: (msg as any).reply_to_id as string | null };
  });

  // Compute search matches
  const matchIds = useMemo(() => {
    const q = chatSearch.trim().toLowerCase();
    if (!q) return [] as string[];
    return uiMessages.filter(({ ui }) => ui.text.toLowerCase().includes(q)).map(({ ui }) => ui.id);
  }, [chatSearch, uiMessages]);

  useEffect(() => {
    setMatchIdx(0);
  }, [chatSearch]);

  // Scroll active match into view
  useEffect(() => {
    if (!matchIds.length) return;
    const id = matchIds[matchIdx];
    const el = document.querySelector(`[data-msg-id="${id}"]`);
    if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [matchIdx, matchIds]);

  const activeConvo = conversations.find((c) => c.id === activeChat);
  const filteredConversations = conversations.filter((c) => {
    const name = c.otherProfile?.display_name || c.name || "";
    return name.toLowerCase().includes(search.toLowerCase());
  });

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

  const storyViewerData = stories.map((s) => ({
    id: s.id,
    userId: s.user_id,
    userName: s.profile?.display_name || "User",
    avatar: (s.profile?.display_name || "U").slice(0, 2).toUpperCase(),
    imageUrl: s.image_url,
    caption: s.caption || undefined,
    musicUrl: (s as any).music_url || undefined,
    mediaType: ((s as any).media_type || "image") as "image" | "video",
    textOverlay: (s as any).text_overlay || null,
    duration: (s as any).duration || null,
  }));

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
      {storyViewerIndex !== null && storyViewerData.length > 0 && (
        <StoryViewer
          stories={storyViewerData}
          initialIndex={storyViewerIndex}
          onClose={() => setStoryViewerIndex(null)}
          currentUserId={user?.id}
        />
      )}

      {webrtc.callStatus !== "idle" && webrtc.activeCall && (
        <CallDialog
          callInfo={webrtc.activeCall}
          callStatus={webrtc.callStatus}
          isMuted={webrtc.isMuted}
          isVideoOn={webrtc.isVideoOn}
          duration={webrtc.duration}
          remoteStream={webrtc.remoteStream}
          localVideoRef={webrtc.localVideoRef}
          remoteVideoRef={webrtc.remoteVideoRef}
          onAccept={() => {
            const pending = (window as any).__pendingOffer;
            if (pending && webrtc.activeCall) {
              webrtc.acceptCall(webrtc.activeCall, pending);
              delete (window as any).__pendingOffer;
            }
          }}
          onReject={webrtc.rejectCall}
          onEnd={webrtc.endCall}
          onToggleMute={webrtc.toggleMute}
          onToggleVideo={webrtc.toggleVideo}
        />
      )}

      {forwardMsg && (
        <ForwardDialog
          open={!!forwardMsg}
          onClose={() => setForwardMsg(null)}
          messageContent={forwardMsg.content}
          messageType={forwardMsg.type}
          mediaUrl={forwardMsg.mediaUrl}
        />
      )}

      

      {/* Sidebar */}
      <div className={`${showSidebar ? "flex" : "hidden"} md:flex flex-col w-full md:w-[380px] lg:w-[420px] border-r border-border/50 bg-card/50`}>
        <div className="flex items-center justify-between px-4 py-3 border-b border-border/50">
          <div className="flex items-center gap-2.5">
            <img src={tigerLogo} alt="TIGERCHATS" className="w-9 h-9" width={512} height={512} />
            <h1 className="text-lg font-bold tracking-tight text-foreground">
              TIGER<span className="text-primary">CHATS</span>
            </h1>
          </div>
          <div className="flex items-center gap-1">
            <NewDmDialog onStarted={(id) => { setActiveChat(id); refetchConversations(); }} />
            <NewGroupDialog onCreated={() => refetchConversations()} />
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
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search chats..."
              className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground outline-none"
            />
          </div>
        </div>

        <StoriesBar
          stories={storyBarData}
          onStoryClick={(index) => setStoryViewerIndex(index)}
          onAddStory={() => {}}
        />

        <div className="flex-1 overflow-y-auto scrollbar-thin">
          {convosLoading ? (
            <div className="flex items-center justify-center py-20">
              <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            </div>
          ) : filteredConversations.length === 0 ? (
            <div className="text-center py-20 px-4">
              <MessageCircle className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
              <p className="text-sm text-muted-foreground">No conversations yet</p>
              <p className="text-xs text-muted-foreground mt-1">Tap the ✏️ icon to start a new chat!</p>
            </div>
          ) : (
            filteredConversations.map((convo) => (
              <ChatListItem
                key={convo.id}
                contact={{
                  id: convo.id,
                  name: convo.otherProfile?.display_name || convo.name || "Chat",
                  avatar: (convo.otherProfile?.display_name || "C").slice(0, 2).toUpperCase(),
                  lastMessage: convo.lastMessage?.content || "No messages yet",
                  time: convo.lastMessage
                    ? new Date(convo.lastMessage.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
                    : "",
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

      {/* Chat Area */}
      <div className={`${!showSidebar ? "flex" : "hidden"} md:flex flex-1 flex-col`}>
        {activeConvo ? (
          <div className="flex flex-col h-full">
            <div className="flex items-center gap-3 px-4 py-3 glass border-b border-border/50">
              <button onClick={() => setActiveChat(null)} className="md:hidden p-1 hover:bg-surface-hover rounded-full transition-colors">
                <ArrowLeft className="w-5 h-5 text-foreground" />
              </button>
              <div className="relative">
                <div className="w-10 h-10 rounded-full bg-secondary flex items-center justify-center text-sm font-semibold text-secondary-foreground">
                  {activeConvoAvatar}
                </div>
                {activeConvo.otherProfile?.is_online && (
                  <div className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full bg-primary border-2 border-background" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-semibold text-sm text-foreground">{activeConvoName}</h3>
                <p className="text-[11px] text-muted-foreground">
                  {isTyping ? (
                    <span className="text-primary animate-pulse">typing...</span>
                  ) : isGroup ? (
                    <span>Group</span>
                  ) : activeConvo.otherProfile?.is_online ? (
                    <span className="text-primary">online</span>
                  ) : (
                    "last seen recently"
                  )}
                </p>
              </div>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setChatSearchOpen((o) => !o)}
                  className={`p-2 rounded-full hover:bg-surface-hover transition-colors ${chatSearchOpen ? "text-primary" : "text-muted-foreground hover:text-primary"}`}
                  title="Search messages"
                >
                  <Search className="w-4 h-4" />
                </button>
                <button onClick={() => handleStartCall(false)} className="p-2 rounded-full hover:bg-surface-hover transition-colors text-muted-foreground hover:text-primary">
                  <Phone className="w-4 h-4" />
                </button>
                <button onClick={() => handleStartCall(true)} className="p-2 rounded-full hover:bg-surface-hover transition-colors text-muted-foreground hover:text-primary">
                  <Video className="w-4 h-4" />
                </button>
                {isGroup && (
                  <>
                    <InviteMembersDialog
                      conversationId={activeConvo.id}
                      existingMemberIds={[user?.id || ""]}
                      onInvited={() => refetchConversations()}
                    />
                    <GroupAdminDialog conversationId={activeConvo.id} />
                  </>
                )}
                <ChatCustomizationDialog conversationId={activeConvo.id} />
              </div>
            </div>

            {chatSearchOpen && (
              <div className="flex items-center gap-2 px-4 py-2 border-b border-border/50 bg-card/80">
                <Search className="w-4 h-4 text-muted-foreground" />
                <input
                  autoFocus
                  value={chatSearch}
                  onChange={(e) => setChatSearch(e.target.value)}
                  placeholder="Search in conversation..."
                  className="flex-1 bg-transparent text-sm outline-none text-foreground placeholder:text-muted-foreground"
                />
                {chatSearch && (
                  <span className="text-[11px] text-muted-foreground tabular-nums">
                    {matchIds.length === 0 ? "0" : `${matchIdx + 1}/${matchIds.length}`}
                  </span>
                )}
                <button
                  onClick={() => setMatchIdx((i) => (matchIds.length ? (i - 1 + matchIds.length) % matchIds.length : 0))}
                  disabled={!matchIds.length}
                  className="p-1 text-muted-foreground hover:text-foreground disabled:opacity-30"
                >
                  <ChevronUp className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setMatchIdx((i) => (matchIds.length ? (i + 1) % matchIds.length : 0))}
                  disabled={!matchIds.length}
                  className="p-1 text-muted-foreground hover:text-foreground disabled:opacity-30"
                >
                  <ChevronDown className="w-4 h-4" />
                </button>
                <button
                  onClick={() => {
                    setChatSearchOpen(false);
                    setChatSearch("");
                  }}
                  className="p-1 text-muted-foreground hover:text-foreground"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            )}

            <div ref={messagesScrollRef} className={`flex-1 overflow-y-auto scrollbar-thin p-4 space-y-1 relative ${wallpaperClass(chatPrefs.wallpaper)} ${fontSizeClass(chatPrefs.font_size)}`}>
              {(!chatPrefs.wallpaper || chatPrefs.wallpaper === "default") && <TigerChatBackground />}
              {uiMessages.map(({ ui, replyToId }) => {
                const isMatch = matchSet.has(ui.id);
                const isActive = ui.id === activeMatchId;
                return (
                  <div
                    key={ui.id}
                    data-msg-id={ui.id}
                    className={
                      isActive
                        ? "rounded-lg ring-2 ring-primary ring-offset-2 ring-offset-background transition-all"
                        : isMatch
                        ? "rounded-lg ring-1 ring-primary/40 transition-all"
                        : ""
                    }
                  >
                    <MessageBubble
                      message={ui}
                      replyMessage={replyToId ? messageMap.get(replyToId) || null : null}
                      onReply={(msg) => setReplyTo(msg)}
                      onForward={(msg) => setForwardMsg({ content: msg.text, type: msg.type, mediaUrl: msg.mediaUrl })}
                      onDelete={handleDeleteMessage}
                      myBubbleClass={bubbleColorClass(chatPrefs.bubble_color)}
                    />
                  </div>
                );
              })}
              <div ref={messagesEndRef} />
            </div>

            <MessageInput
              onSend={handleSend}
              onSendVoice={handleSendVoice}
              onSendFile={handleSendFile}
              onTyping={notifyTyping}
              replyTo={replyTo}
              onCancelReply={() => setReplyTo(null)}
            />
          </div>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center gap-4 text-center p-8">
            <img src={tigerLogo} alt="TIGERCHATS" className="w-24 h-24 opacity-30" width={512} height={512} />
            <div>
              <h2 className="text-xl font-bold text-foreground mb-1">
                Welcome to <span className="text-primary">TIGERCHATS</span>
              </h2>
              <p className="text-sm text-muted-foreground max-w-sm">
                Select a chat to start messaging.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Chats;
