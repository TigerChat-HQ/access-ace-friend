import { useState, useMemo } from "react";
import { Search, Edit, Settings, Users, MessageCircle } from "lucide-react";
import { ChatContact, Message } from "@/types/chat";
import { mockContacts, mockMessages, mockStories } from "@/data/mockData";
import { StoriesBar } from "@/components/chat/StoriesBar";
import { ChatListItem } from "@/components/chat/ChatListItem";
import { ChatView } from "@/components/chat/ChatView";
import tigerLogo from "@/assets/tigerchats-logo.png";

const Index = () => {
  const [activeChat, setActiveChat] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [messages, setMessages] = useState<Record<string, Message[]>>(mockMessages);
  const [showSidebar, setShowSidebar] = useState(true);

  const filteredContacts = useMemo(
    () => mockContacts.filter((c) => c.name.toLowerCase().includes(search.toLowerCase())),
    [search]
  );

  const activeContact = mockContacts.find((c) => c.id === activeChat);

  const handleSend = (text: string) => {
    if (!activeChat) return;
    const newMsg: Message = {
      id: `m${Date.now()}`,
      senderId: "me",
      text,
      time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      status: "sent",
      type: "text",
    };
    setMessages((prev) => ({
      ...prev,
      [activeChat]: [...(prev[activeChat] || []), newMsg],
    }));
  };

  const handleSelectChat = (id: string) => {
    setActiveChat(id);
    setShowSidebar(false);
  };

  return (
    <div className="h-screen flex overflow-hidden bg-background">
      {/* Sidebar */}
      <div
        className={`${
          showSidebar ? "flex" : "hidden"
        } md:flex flex-col w-full md:w-[380px] lg:w-[420px] border-r border-border/50 bg-card/50`}
      >
        {/* App Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border/50">
          <div className="flex items-center gap-2.5">
            <img src={tigerLogo} alt="TIGERCHATS" className="w-9 h-9" width={512} height={512} />
            <h1 className="text-lg font-bold tracking-tight neon-text text-foreground">
              TIGER<span className="text-primary">CHATS</span>
            </h1>
          </div>
          <div className="flex items-center gap-1">
            <button className="p-2 rounded-full hover:bg-surface-hover transition-colors text-muted-foreground hover:text-primary">
              <Users className="w-4 h-4" />
            </button>
            <button className="p-2 rounded-full hover:bg-surface-hover transition-colors text-muted-foreground hover:text-primary">
              <Edit className="w-4 h-4" />
            </button>
            <button className="p-2 rounded-full hover:bg-surface-hover transition-colors text-muted-foreground hover:text-foreground">
              <Settings className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Search */}
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

        {/* Stories */}
        <StoriesBar stories={mockStories} />

        {/* Chat List */}
        <div className="flex-1 overflow-y-auto scrollbar-thin">
          {filteredContacts.map((contact) => (
            <ChatListItem
              key={contact.id}
              contact={contact}
              isActive={activeChat === contact.id}
              onClick={() => handleSelectChat(contact.id)}
            />
          ))}
        </div>
      </div>

      {/* Chat Area */}
      <div className={`${!showSidebar ? "flex" : "hidden"} md:flex flex-1 flex-col`}>
        {activeContact ? (
          <ChatView
            contact={activeContact}
            messages={messages[activeChat!] || []}
            onBack={() => setShowSidebar(true)}
            onSend={handleSend}
          />
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
