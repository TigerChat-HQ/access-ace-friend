import { useState, useRef, useEffect } from "react";
import { Send, Smile, Paperclip, Mic, X, FileText, Reply, MapPin, Contact, Volume2, VolumeX, Check, Search } from "lucide-react";
import { playChatEmojiSound, CHAT_EMOJIS, CHAT_EMOJI_SOUND_KEY } from "@/lib/chat-emoji";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { contactMessage, locationMessage } from "@/lib/chat-sharing";
import { toast } from "sonner";
import { VoiceRecorder } from "./VoiceRecorder";
import { Message } from "@/types/chat";
import { cn } from "@/lib/utils";

type DeviceContact = { id: string; name: string; phone: string };
type ContactsBridgeWindow = Window & { TigerNative?: { hasContactsPermission?: () => boolean; requestContactsPermission?: () => void; searchContacts?: (query: string) => string } };

interface MessageInputProps {
  onSend: (text: string) => void;
  onSendVoice?: (blob: Blob, duration: number) => void;
  onSendFile?: (file: File) => void;
  onTyping?: () => void;
  replyTo?: Message | null;
  onCancelReply?: () => void;
  editingMessage?: Message | null;
  onCancelEdit?: () => void;
}

export const MessageInput = ({ onSend, onSendVoice, onSendFile, onTyping, replyTo, onCancelReply, editingMessage, onCancelEdit }: MessageInputProps) => {
  const [text, setText] = useState("");
  useEffect(() => { setText(editingMessage?.text || ""); }, [editingMessage?.id]);
  const [emojiOpen, setEmojiOpen] = useState(false);
  const [emojiSound, setEmojiSound] = useState(() => localStorage.getItem(CHAT_EMOJI_SOUND_KEY) !== "false");
  const [isRecording, setIsRecording] = useState(false);
  const [attachedFile, setAttachedFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [contactOpen, setContactOpen] = useState(false);
  const [contactName, setContactName] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [contactSearch, setContactSearch] = useState("");
  const [phoneContacts, setPhoneContacts] = useState<DeviceContact[]>([]);
  const [contactsPermissionGranted, setContactsPermissionGranted] = useState(false);
  const [nativeContactsAvailable, setNativeContactsAvailable] = useState(false);
  const [locating, setLocating] = useState(false);

  useEffect(() => {
    const onContactsPermission = (event: Event) => {
      const granted = Boolean((event as CustomEvent<{ granted?: boolean }>).detail?.granted);
      setContactsPermissionGranted(granted);
      if (!granted) toast.error("Contacts permission was not granted. You can still enter a contact manually.");
    };
    window.addEventListener("tiger:contacts-permission", onContactsPermission);
    return () => window.removeEventListener("tiger:contacts-permission", onContactsPermission);
  }, []);

  useEffect(() => {
    const inlineContactSearch = !contactOpen && text.startsWith("@");
    if ((!contactOpen && !inlineContactSearch) || !contactsPermissionGranted) { setPhoneContacts([]); return; }
    const bridge = (window as ContactsBridgeWindow).TigerNative;
    if (!bridge?.searchContacts) return;
    try {
      const query = contactOpen ? contactSearch : text.slice(1).trim();
      const parsed: unknown = JSON.parse(bridge.searchContacts(query));
      setPhoneContacts(Array.isArray(parsed) ? parsed.filter((item): item is DeviceContact =>
        item && typeof item.id === "string" && typeof item.name === "string" && typeof item.phone === "string"
      ) : []);
    } catch { setPhoneContacts([]); }
  }, [contactOpen, contactSearch, contactsPermissionGranted, text]);

  const openContactPicker = () => {
    setContactOpen(true);
    setContactSearch("");
    const bridge = (window as ContactsBridgeWindow).TigerNative;
    const available = Boolean(bridge?.searchContacts && bridge?.requestContactsPermission);
    setNativeContactsAvailable(available);
    if (available) {
      const granted = bridge?.hasContactsPermission?.() ?? false;
      setContactsPermissionGranted(granted);
      if (!granted) bridge?.requestContactsPermission?.();
    } else setContactsPermissionGranted(false);
  };

  const choosePhoneContact = (contact: DeviceContact) => {
    try {
      setText(contactMessage(contact.name, contact.phone));
      setContactName(contact.name);
      setContactPhone(contact.phone);
      setContactOpen(false);
    } catch (error) { toast.error(error instanceof Error ? error.message : "Could not add this contact."); }
  };

  const shareLocation = () => {
    if (!navigator.geolocation) { toast.error("Location is unavailable on this device."); return; }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(position => {
      setText(locationMessage(position.coords.latitude, position.coords.longitude)); setLocating(false);
    }, error => { toast.error(error.message); setLocating(false); }, { enableHighAccuracy: true, timeout: 15000 });
  };

  const toggleEmojiSound = () => {
    setEmojiSound((enabled) => {
      const next = !enabled;
      localStorage.setItem(CHAT_EMOJI_SOUND_KEY, String(next));
      return next;
    });
  };

  const insertEmoji = (emoji: string) => {
    setText((current) => `${current}${emoji}`);
    if (emojiSound) playChatEmojiSound(emoji);
    setEmojiOpen(false);
  };

  const handleSend = () => {
    if (attachedFile && onSendFile) {
      onSendFile(attachedFile);
      setAttachedFile(null);
      setPreview(null);
    }
    if (text.trim()) {
      onSend(text.trim());
      setText("");
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setAttachedFile(file);
    if (file.type.startsWith("image/")) {
      setPreview(URL.createObjectURL(file));
    } else {
      setPreview(null);
    }
    e.target.value = "";
  };

  const removeAttachment = () => {
    if (preview) URL.revokeObjectURL(preview);
    setAttachedFile(null);
    setPreview(null);
  };

  const handleTextChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setText(value);
    if (value.startsWith("@") && !nativeContactsAvailable) {
      const bridge = (window as ContactsBridgeWindow).TigerNative;
      const available = Boolean(bridge?.searchContacts && bridge?.requestContactsPermission);
      setNativeContactsAvailable(available);
      if (available) {
        const granted = bridge?.hasContactsPermission?.() ?? false;
        setContactsPermissionGranted(granted);
        if (!granted) bridge?.requestContactsPermission?.();
      }
    }
    onTyping?.();
  };

  if (isRecording) {
    return (
      <VoiceRecorder
        onSend={(blob, duration) => {
          onSendVoice?.(blob, duration);
          setIsRecording(false);
        }}
        onCancel={() => setIsRecording(false)}
      />
    );
  }

  return (
    <div className="tiger-chat-composer border-t border-border/50 glass">
      {editingMessage && (
        <div className="mb-2 flex items-center gap-2 rounded-lg border-l-2 border-amber-500 bg-amber-500/10 p-2">
          <span className="flex-1 text-xs font-medium text-amber-600">Editing message</span>
          <button type="button" onClick={() => { setText(""); onCancelEdit?.(); }} className="rounded-full p-1 hover:bg-surface-hover" aria-label="Cancel edit"><X className="h-3.5 w-3.5" /></button>
        </div>
      )}
      {/* Reply preview */}
      {replyTo && (
        <div className="flex items-center gap-2 mb-2 p-2 bg-surface rounded-lg border-l-2 border-primary">
          <Reply className="w-4 h-4 text-primary shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-[10px] text-primary font-medium">
              {replyTo.senderId === "me" ? "You" : "Them"}
            </p>
            <p className="text-xs text-muted-foreground truncate">
              {replyTo.text || (replyTo.type === "image" ? "📷 Image" : replyTo.type === "voice" ? "🎤 Voice" : "📎 File")}
            </p>
          </div>
          <button onClick={onCancelReply} className="p-1 rounded-full hover:bg-surface-hover">
            <X className="w-3.5 h-3.5 text-muted-foreground" />
          </button>
        </div>
      )}

      {/* Attachment preview */}
      {attachedFile && (
        <div className="flex items-center gap-2 mb-2 p-2 bg-surface rounded-lg">
          {preview ? (
            <img src={preview} alt="Preview" className="w-16 h-16 object-cover rounded-md" />
          ) : (
            <div className="w-16 h-16 bg-surface-hover rounded-md flex items-center justify-center">
              <FileText className="w-6 h-6 text-muted-foreground" />
            </div>
          )}
          <div className="flex-1 min-w-0">
            <p className="text-xs text-foreground truncate">{attachedFile.name}</p>
            <p className="text-[10px] text-muted-foreground">{(attachedFile.size / 1024).toFixed(1)} KB</p>
          </div>
          <button onClick={removeAttachment} className="p-1 rounded-full hover:bg-surface-hover">
            <X className="w-4 h-4 text-muted-foreground" />
          </button>
        </div>
      )}
      {emojiOpen && (
        <div className="mb-3 rounded-2xl border border-border/60 bg-card/95 p-3 shadow-xl animate-in fade-in slide-in-from-bottom-2">
          <div className="mb-2 flex items-center justify-between"><span className="text-xs font-semibold text-muted-foreground">Animated emojis</span><button type="button" onClick={toggleEmojiSound} aria-label={emojiSound ? "Mute emoji sounds" : "Enable emoji sounds"} className="rounded-full p-1.5 text-muted-foreground hover:bg-surface-hover">{emojiSound ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}</button></div>
          <div className="grid grid-cols-8 gap-2">{CHAT_EMOJIS.map((emoji) => <button key={emoji} type="button" onClick={() => insertEmoji(emoji)} className="chat-emoji-picker-item rounded-lg p-1 text-2xl hover:bg-surface-hover" aria-label={`Insert ${emoji}`}>{emoji}</button>)}</div>
        </div>
      )}
      {!contactOpen && nativeContactsAvailable && text.startsWith("@") && contactsPermissionGranted && (
        <div className="mb-2 max-h-48 overflow-y-auto rounded-xl border border-border/60 bg-card shadow-lg">
          <p className="px-3 py-2 text-[11px] text-muted-foreground">Phone contacts · select one to insert it into your message</p>
          {phoneContacts.length ? phoneContacts.map(contact => <button key={contact.id + contact.phone} type="button" onClick={() => choosePhoneContact(contact)} className="flex w-full items-center justify-between gap-3 px-3 py-2 text-left hover:bg-muted"><span className="min-w-0"><span className="block truncate text-sm font-medium">{contact.name}</span><span className="block text-xs text-muted-foreground">{contact.phone}</span></span><Contact className="h-4 w-4 shrink-0 text-primary" /></button>) : <p className="px-3 py-4 text-center text-xs text-muted-foreground">No matching contacts found.</p>}
        </div>
      )}
      <div className="flex items-center gap-2">
        <button type="button" onClick={() => setEmojiOpen((open) => !open)} aria-label="Open emoji picker" aria-expanded={emojiOpen} className={cn("p-2 rounded-full transition-colors", emojiOpen ? "bg-primary/15 text-primary" : "text-muted-foreground hover:bg-surface-hover hover:text-foreground")}>
          <Smile className="w-5 h-5" />
        </button>
        <DropdownMenu><DropdownMenuTrigger asChild><Button variant="ghost" size="icon" aria-label="Share attachment" disabled={locating}><Paperclip className="w-5 h-5" /></Button></DropdownMenuTrigger>
          <DropdownMenuContent><DropdownMenuItem onSelect={() => fileRef.current?.click()}><FileText className="mr-2 w-4 h-4" />Photo, video or file</DropdownMenuItem><DropdownMenuItem onSelect={shareLocation}><MapPin className="mr-2 w-4 h-4" />Current location</DropdownMenuItem><DropdownMenuItem onSelect={openContactPicker}><Contact className="mr-2 w-4 h-4" />Search phone contacts</DropdownMenuItem></DropdownMenuContent>
        </DropdownMenu>
        <input ref={fileRef} type="file" accept="image/*,video/*,audio/*,.vcf,.pdf,.doc,.docx,.zip" onChange={handleFileChange} className="hidden" />
        <input
          ref={inputRef}
          value={text}
          onChange={handleTextChange}
          onKeyDown={(e) => e.key === "Enter" && handleSend()}
          placeholder={editingMessage ? "Edit your message..." : "Type a message or @contact..."}
          className="min-w-0 flex-1 bg-surface rounded-full px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:ring-1 focus:ring-primary/50 transition-all"
        />
        {text.trim() || attachedFile ? (
          <button
            onClick={handleSend}
            className="p-2.5 rounded-full bg-primary text-primary-foreground hover:opacity-90 transition-all neon-glow"
          >
            {editingMessage ? <Check className="w-4 h-4" /> : <Send className="w-4 h-4" />}
          </button>
        ) : (
          <button
            onClick={() => setIsRecording(true)}
            className="p-2.5 rounded-full bg-primary text-primary-foreground hover:opacity-90 transition-all neon-glow"
          >
            <Mic className="w-4 h-4" />
          </button>
        )}
      </div>
      <Dialog open={contactOpen} onOpenChange={setContactOpen}><DialogContent className="max-h-[85vh] overflow-y-auto"><DialogHeader><DialogTitle>Share a phone contact</DialogTitle></DialogHeader>
        {nativeContactsAvailable && contactsPermissionGranted ? (
          <div className="space-y-3">
            <div className="relative"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" /><Input autoFocus aria-label="Search phone contacts" placeholder="Search names or phone numbers..." value={contactSearch} onChange={e => setContactSearch(e.target.value)} className="pl-9" /></div>
            <p className="text-xs text-muted-foreground">Contacts are searched on this phone. They are not uploaded to TigerChat.</p>
            <div className="max-h-64 space-y-1 overflow-y-auto">{phoneContacts.length ? phoneContacts.map(contact => <button key={contact.id + contact.phone} type="button" onClick={() => choosePhoneContact(contact)} className="flex w-full items-center justify-between gap-3 rounded-xl p-3 text-left hover:bg-muted"><span className="min-w-0"><span className="block truncate text-sm font-medium">{contact.name}</span><span className="block text-xs text-muted-foreground">{contact.phone}</span></span><Contact className="h-4 w-4 shrink-0 text-primary" /></button>) : <p className="py-6 text-center text-sm text-muted-foreground">{contactSearch ? "No matching contacts found." : "No contacts with phone numbers found."}</p>}</div>
          </div>
        ) : (
          <form className="space-y-3" onSubmit={e => { e.preventDefault(); try { setText(contactMessage(contactName, contactPhone)); setContactOpen(false); } catch (error) { toast.error(error instanceof Error ? error.message : "Invalid contact"); } }}>
            {nativeContactsAvailable && <p className="text-sm text-muted-foreground">Allow Contacts access in the Android permission prompt to search your phone book. You can also enter a contact manually below.</p>}
            <Input aria-label="Contact name" placeholder="Name" value={contactName} onChange={e => setContactName(e.target.value)} maxLength={100} />
            <Input aria-label="Contact phone" placeholder="Phone number" type="tel" value={contactPhone} onChange={e => setContactPhone(e.target.value)} />
            <Button type="submit">Add contact</Button>
          </form>
        )}
      </DialogContent></Dialog>
    </div>
  );
};
