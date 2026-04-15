import { useState, useEffect, useRef } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useConversations, useMessages, useSendMessage } from "@/hooks/useChat";
import { StoriesBar } from "@/components/chat/StoriesBar";
import { ChatListItem } from "@/components/chat/ChatListItem";
import { MessageBubble } from "@/components/chat/MessageBubble";
import { MessageInput } from "@/components/chat/MessageInput";
import { StoryViewer } from "@/components/chat/StoryViewer";
import { CallDialog } from "@/components/chat/CallDialog";
import { InviteMembersDialog } from "@/components/chat/InviteMembersDialog";
import { Search, Settings, MessageCircle, ArrowLeft, Phone, Video, MoreVertical, Camera, Users } from "lucide-react";
import { NewGroupDialog } from "@/components/chat/NewGroupDialog";
import { useNavigate } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";
import { Tables } from "@/integrations/supabase/types";
import tigerLogo from "@/assets/tigerchats-logo.png";

type Story = Tables<"stories"> & { profile?: Tables<"profiles"> };

const Index = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [activeChat, setActiveChat] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [showSidebar, setShowSidebar] = useState(true);
  const [stories, setStories] = useState<Story[]>([]);
  const [storyViewerIndex, setStoryViewerIndex] = useState<number | null>(null);
  const [callState, setCallState] = useState<{ name: string; avatar: string; isVideo: boolean } | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const storyInputRef = useRef<HTMLInputElement>(null);

  const { conversations, loading: convosLoading, refetch: refetchConversations } = useConversations();
  const { messages, loading: msgsLoading } = useMessages(activeChat);
  const { sendMessage } = useSendMessage();

  // Fetch stories
  useEffect(() => {
    const fetchStories = async () => {
      const { data } = await supabase
        .from("stories")
        .select("*")
        .order("created_at", { ascending: false });

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
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSend = async (text: string) => {
    if (!activeChat) return;
    await sendMessage(activeChat, text);
  };

  const handleSendVoice = async (blob: Blob, duration: number) => {
    if (!activeChat || !user) return;
    const filePath = `${user.id}/${Date.now()}.webm`;
    const { error: uploadError } = await supabase.storage.from("chat-media").upload(filePath, blob);
    if (uploadError) {
      toast({ title: "Upload failed", description: uploadError.message, variant: "destructive" });
      return;
    }
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

  const handleSelectChat = (id: string) => {
    setActiveChat(id);
    setShowSidebar(false);
  };

  const handleUploadStory = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    const filePath = `${user.id}/${Date.now()}.${file.name.split('.').pop()}`;
    const { error: uploadError } = await supabase.storage.from("stories").upload(filePath, file);
    if (uploadError) {
      toast({ title: "Upload failed", description: uploadError.message, variant: "destructive" });
      return;
    }
    const { data: { publicUrl } } = supabase.storage.from("stories").getPublicUrl(filePath);
    await supabase.from("stories").insert({ user_id: user.id, image_url: publicUrl });
    toast({ title: "Story posted! 📸" });
  };

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
  }));

  const activeConvoName = activeConvo?.otherProfile?.display_name || activeConvo?.name || "Chat";
  const activeConvoAvatar = (activeConvo?.otherProfile?.display_name || "C").slice(0, 2).toUpperCase();
  const isGroup = activeConvo?.type === "group";

  const startCall = (isVideo: boolean) => {
    if (!activeConvo) return;
    setCallState({ name: activeConvoName, avatar: activeConvoAvatar, isVideo });
  };

  return (
    <div className="h-screen flex overflow-hidden bg-background">
      {/* Story viewer */}
      {storyViewerIndex !== null && storyViewerData.length > 0 && (
        <StoryViewer
          stories={storyViewerData}
          initialIndex={storyViewerIndex}
          onClose={() => setStoryViewerIndex(null)}
          currentUserId={user?.id}
        />
      )}

      {/* Call dialog */}
      {callState && (
        <CallDialog
          contactName={callState.name}
          contactAvatar={callState.avatar}
          isVideo={callState.isVideo}
          onEnd={() => setCallState(null)}
        />
      )}

      {/* Hidden story input */}
      <input ref={storyInputRef} type="file" accept="image/*" onChange={handleUploadStory} className="hidden" />

      {/* Sidebar */}
      <div className={`${showSidebar ? "flex" : "hidden"} md:flex flex-col w-full md:w-[380px] lg:w-[420px] border-r border-border/50 bg-card/50`}>
        <div className="flex items-center justify-between px-4 py-3 border-b border-border/50">
          <div className="flex items-center gap-2.5">
            <img src={tigerLogo} alt="TIGERCHATS" className="w-9 h-9" width={512} height={512} />
            <h1 className="text-lg font-bold tracking-tight neon-text text-foreground">
              TIGER<span className="text-primary">CHATS</span>
            </h1>
          </div>
          <div className="flex items-center gap-1">
            <NewGroupDialog onCreated={() => refetchConversations()} />
            <label className="p-2 rounded-full hover:bg-surface-hover transition-colors text-muted-foreground hover:text-primary cursor-pointer">
              <Camera className="w-4 h-4" />
              <input type="file" accept="image/*" onChange={handleUploadStory} className="hidden" />
            </label>
            <button onClick={() => navigate("/settings")} className="p-2 rounded-full hover:bg-surface-hover transition-colors text-muted-foreground hover:text-foreground">
              <Settings className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="px-4 py-2">
          <div className="flex items-center gap-2 bg-surface rounded-xl px-3 py-2">
            <Search className="w-4 h-4 text-muted-foreground" />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search chats..." className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground outline-none" />
          </div>
        </div>

        <StoriesBar
          stories={storyBarData}
          onStoryClick={(index) => setStoryViewerIndex(index)}
          onAddStory={() => storyInputRef.current?.click()}
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
              <p className="text-xs text-muted-foreground mt-1">Start a new chat to get going!</p>
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
                onClick={() => handleSelectChat(convo.id)}
              />
            ))
          )}
        </div>
      </div>

      {/* Chat Area */}
      <div className={`${!showSidebar ? "flex" : "hidden"} md:flex flex-1 flex-col`}>
        {activeConvo ? (
          <div className="flex flex-col h-full">
            {/* Chat Header */}
            <div className="flex items-center gap-3 px-4 py-3 glass border-b border-border/50">
              <button onClick={() => setShowSidebar(true)} className="md:hidden p-1 hover:bg-surface-hover rounded-full transition-colors">
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
                  {isGroup ? (
                    <span className="text-muted-foreground">Group</span>
                  ) : activeConvo.otherProfile?.is_online ? (
                    <span className="text-primary">online</span>
                  ) : (
                    "last seen recently"
                  )}
                </p>
              </div>
              <div className="flex items-center gap-1">
                <button onClick={() => startCall(false)} className="p-2 rounded-full hover:bg-surface-hover transition-colors text-muted-foreground hover:text-primary">
                  <Phone className="w-4 h-4" />
                </button>
                <button onClick={() => startCall(true)} className="p-2 rounded-full hover:bg-surface-hover transition-colors text-muted-foreground hover:text-primary">
                  <Video className="w-4 h-4" />
                </button>
                {isGroup && (
                  <InviteMembersDialog
                    conversationId={activeConvo.id}
                    existingMemberIds={[user?.id || ""]}
                    onInvited={() => refetchConversations()}
                  />
                )}
                <button className="p-2 rounded-full hover:bg-surface-hover transition-colors text-muted-foreground hover:text-foreground">
                  <MoreVertical className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto scrollbar-thin p-4 space-y-1">
              {messages.map((msg) => (
                <MessageBubble
                  key={msg.id}
                  message={{
                    id: msg.id,
                    senderId: msg.sender_id === user?.id ? "me" : msg.sender_id,
                    text: msg.content || "",
                    time: new Date(msg.created_at!).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
                    status: msg.is_read ? "read" : "delivered",
                    type: msg.message_type as "text" | "image" | "voice",
                    mediaUrl: msg.media_url || undefined,
                  }}
                />
              ))}
              <div ref={messagesEndRef} />
            </div>

            {/* Input */}
            <MessageInput onSend={handleSend} onSendVoice={handleSendVoice} />
          </div>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center gap-4 text-center p-8">
            <img src={tigerLogo} alt="TIGERCHATS" className="w-24 h-24 opacity-30" width={512} height={512} />
            <div>
              <h2 className="text-xl font-bold text-foreground mb-1">
                Welcome to <span className="text-primary neon-text">TIGERCHATS</span>
              </h2>
              <p className="text-sm text-muted-foreground max-w-sm">
                Fast like lightning. Secure like a vault. Select a chat to start messaging.
              </p>
            </div>
            <div className="flex items-center gap-2 text-xs text-muted-foreground mt-4">
              <MessageCircle className="w-3.5 h-3.5" />
              <span>End-to-end encrypted</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Index;
