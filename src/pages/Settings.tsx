import { useState, useEffect, useRef } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { useAuth } from "@/contexts/AuthContext";
import { useTheme } from "@/contexts/ThemeContext";
import { useLanguage, Language } from "@/contexts/LanguageContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import {
  ArrowLeft, Camera, User, Bell, Shield, Palette, LogOut, MessageCircle,
  ChevronRight, Moon, Sun, Globe, Lock, Fingerprint, Mail, Volume2, Smartphone, Download, KeyRound, Copy, Gauge, RotateCcw,
} from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";
import { useAppLock, isWebAuthnSupported } from "@/hooks/useAppLock";
import tigerLogo from "@/assets/tigerchats-logo.png";
import { TwoFactorSecurity } from "@/components/TwoFactorSecurity";
import { ChatAppearanceSettings } from "@/components/settings/ChatAppearanceSettings";
import { FloatingBubbleSettings } from "@/components/settings/FloatingBubbleSettings";
import { AndroidUpdateChecker } from "@/components/AndroidUpdateChecker";
import { disablePush, enablePush, isPushEnabled } from "@/lib/firebase-push";
import { ringtoneOptions, getStoredRingtone, setStoredRingtone, playRingtone, type RingtoneId } from "@/lib/ringtones";
import { getNotificationPreferences, saveNotificationPreferences, type NotificationPreferences } from "@/lib/notification-preferences";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

const db = supabase as unknown as SupabaseClient;

const SettingToggle = ({
  label, description, value, onChange, icon,
}: {
  label: string; description: string; value: boolean;
  onChange: (v: boolean) => void; icon?: React.ReactNode;
}) => (
  <div className="flex w-full items-center gap-3 py-3">
    <button
      type="button"
      aria-pressed={value}
      onClick={() => onChange(!value)}
      className="flex min-w-0 flex-1 items-center gap-3 rounded-lg text-left outline-none transition-colors hover:bg-surface-hover focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background"
    >
      {icon && <span className="flex h-9 w-9 shrink-0 items-center justify-center text-muted-foreground">{icon}</span>}
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-medium leading-5 text-foreground">{label}</span>
        <span className="mt-0.5 block break-words text-xs leading-5 text-muted-foreground">{description}</span>
      </span>
    </button>
    <div className="flex shrink-0 items-center justify-center pl-1">
      <Switch checked={value} onCheckedChange={onChange} aria-label={label} />
    </div>
  </div>
);

const Settings = () => {
  const { user, signOut } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const { language, setLanguage, t } = useLanguage();
  const navigate = useNavigate();
  const location = useLocation();
  const { toast } = useToast();
  const isNativeAndroid = typeof window !== "undefined" && typeof window.TigerNative?.getFcmToken === "function";
  const [displayName, setDisplayName] = useState("");
  const [bio, setBio] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [activeSection, setActiveSection] = useState<string | null>(null);
  useEffect(() => {
    const requestedSection = (location.state as { section?: string } | null)?.section;
    if (requestedSection === "general") setActiveSection("general");
  }, [location.state]);
  const [dataSaver, setDataSaver] = useState(() => { try { return localStorage.getItem("tigerchats:data-saver") === "true"; } catch { return false; } });
  const updateDataSaver = (enabled: boolean) => { setDataSaver(enabled); try { localStorage.setItem("tigerchats:data-saver", String(enabled)); } catch { /* storage may be unavailable */ } };
  const [notifications, setNotifications] = useState(() => isNativeAndroid ? (window.TigerNative?.areNotificationsEnabled?.() ?? false) : user ? isPushEnabled(user.id) : false);
  const [pushBusy, setPushBusy] = useState(false);
  const [pushMessage, setPushMessage] = useState("");
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [appInstalled, setAppInstalled] = useState(false);
  const [installPlatform, setInstallPlatform] = useState<"ios" | "other">("other");
  const [notificationPrefs, setNotificationPrefs] = useState<NotificationPreferences>(() => getNotificationPreferences(user?.id));
  const [readReceipts, setReadReceipts] = useState(true);
  const [lastSeen, setLastSeen] = useState(true);
  const [onlineStatus, setOnlineStatus] = useState(true);
  const [isPrivate, setIsPrivate] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmNewPassword, setConfirmNewPassword] = useState("");
  const [passwordBusy, setPasswordBusy] = useState(false);
    const [incomingCallTone, setIncomingCallTone] = useState<RingtoneId>(() => getStoredRingtone("incoming_call"));
  const [incomingSmsTone, setIncomingSmsTone] = useState<RingtoneId>(() => getStoredRingtone("incoming_sms"));
  const previewStopRef = useRef<(() => void) | null>(null);
  const previewTimerRef = useRef<number | null>(null);
  const appLock = useAppLock();

  useEffect(() => {
    setNotificationPrefs(getNotificationPreferences(user?.id));
    const refreshPushState = () => setNotifications(isNativeAndroid ? (window.TigerNative?.areNotificationsEnabled?.() ?? false) : user ? isPushEnabled(user.id) : false);
    refreshPushState();
    window.addEventListener("focus", refreshPushState);
    document.addEventListener("visibilitychange", refreshPushState);
    return () => {
      window.removeEventListener("focus", refreshPushState);
      document.removeEventListener("visibilitychange", refreshPushState);
    };
  }, [user?.id, isNativeAndroid]);

  const updateNotificationPreference = (patch: Partial<NotificationPreferences>) => {
    setNotificationPrefs(saveNotificationPreferences(user?.id, patch));
  };

  const previewTone = (kind: "incoming_call" | "incoming_sms") => {
    if (previewTimerRef.current !== null) window.clearTimeout(previewTimerRef.current);
    previewStopRef.current?.();
    previewStopRef.current = playRingtone(kind);
    previewTimerRef.current = window.setTimeout(() => {
      previewStopRef.current?.();
      previewStopRef.current = null;
      previewTimerRef.current = null;
    }, 1800);
  };

  useEffect(() => () => {
    if (previewTimerRef.current !== null) window.clearTimeout(previewTimerRef.current);
    previewStopRef.current?.();
  }, []);

  const updateTone = (kind: "incoming_call" | "incoming_sms", value: RingtoneId) => {
    setStoredRingtone(kind, value);
    if (kind === "incoming_call") setIncomingCallTone(value);
    else setIncomingSmsTone(value);
  };

  const toggleAppLock = async (v: boolean) => {
    try {
      if (v) {
        const ok = await appLock.enable();
        if (ok) toast({ title: "App lock enabled" });
      } else {
        appLock.disable();
        toast({ title: "App lock disabled" });
      }
    } catch (error: unknown) {
      toast({ title: "Failed", description: error instanceof Error ? error.message : "Could not enable", variant: "destructive" });
    }
  };

  useEffect(() => {
    const standalone = window.matchMedia("(display-mode: standalone)").matches ||
      (navigator as Navigator & { standalone?: boolean }).standalone === true;
    setAppInstalled(standalone);
    setInstallPlatform(/iPad|iPhone|iPod/.test(navigator.userAgent || "") ? "ios" : "other");
    const onBeforeInstall = (event: Event) => {
      event.preventDefault();
      setInstallPrompt(event as BeforeInstallPromptEvent);
    };
    const onInstalled = () => {
      setAppInstalled(true);
      setInstallPrompt(null);
      toast({ title: "TIGERCHATS installed successfully" });
    };
    window.addEventListener("beforeinstallprompt", onBeforeInstall);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstall);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  const installApp = async () => {
    if (appInstalled) return;
    if (installPrompt) {
      await installPrompt.prompt();
      const choice = await installPrompt.userChoice;
      if (choice.outcome === "accepted") setAppInstalled(true);
      setInstallPrompt(null);
      return;
    }
    toast({
      title: "Install TIGERCHATS",
      description: installPlatform === "ios"
        ? "Safari: gusa Share, kisha Add to Home Screen."
        : "Chrome: fungua menyu ya ⋮ kisha chagua Install app au Add to Home screen.",
    });
  };

  useEffect(() => {
    if (user) loadProfile();
  }, [user]);

  const loadProfile = async () => {
    const { data } = await supabase
      .from("profiles").select("*").eq("user_id", user!.id).single();
    if (data) {
      setDisplayName(data.display_name || "");
      setBio(data.bio || "");
      setAvatarUrl(data.avatar_url || "");
      setIsPrivate((data as typeof data & { is_private?: boolean }).is_private ?? false);
      setLastSeen(data.show_last_seen ?? true);
      setOnlineStatus(data.show_online_status ?? true);
    }
  };

  const updatePresencePrivacy = async (field: "show_last_seen" | "show_online_status", value: boolean) => {
    if (field === "show_last_seen") setLastSeen(value);
    else setOnlineStatus(value);
    const { error } = await db.from("profiles").update({ [field]: value }).eq("user_id", user!.id);
    if (error) {
      if (field === "show_last_seen") setLastSeen(!value);
      else setOnlineStatus(!value);
      toast({ title: "Failed to update presence privacy", description: error.message, variant: "destructive" as const });
    }
  };

  const updatePrivacy = async (v: boolean) => {
    setIsPrivate(v);
    const { error } = await db
      .from("profiles").update({ is_private: v }).eq("user_id", user!.id);
    if (error) toast({ title: "Failed", description: error.message, variant: "destructive" as const });
    else toast({ title: v ? "Account is now private" : "Account is now public" });
  };

  const updateProfile = async () => {
    setLoading(true);
    const { error } = await supabase
      .from("profiles").update({ display_name: displayName, bio }).eq("user_id", user!.id);
    toast(error
      ? { title: t("error"), description: error.message, variant: "destructive" as const }
      : { title: t("profileUpdated") });
    setLoading(false);
  };

  const uploadAvatar = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const filePath = `${user!.id}/${Date.now()}.${file.name.split('.').pop()}`;
    const { error: uploadError } = await supabase.storage.from("avatars").upload(filePath, file);
    if (uploadError) {
      toast({ title: t("uploadFailed"), description: uploadError.message, variant: "destructive" });
      return;
    }
    const { data: { publicUrl } } = supabase.storage.from("avatars").getPublicUrl(filePath);
    await supabase.from("profiles").update({ avatar_url: publicUrl }).eq("user_id", user!.id);
    setAvatarUrl(publicUrl);
    toast({ title: t("avatarUpdated") });
  };

  const changePassword = async () => {
    if (!currentPassword || !newPassword || !confirmNewPassword) {
      toast({ title: "Jaza sehemu zote za nenosiri", variant: "destructive" });
      return;
    }
    if (newPassword.length < 8) {
      toast({ title: "Nenosiri ni fupi", description: "Tumia angalau herufi/namba 8.", variant: "destructive" });
      return;
    }
    if (newPassword !== confirmNewPassword) {
      toast({ title: "Nenosiri halifanani", description: "Thibitisha nenosiri jipya kwa usahihi.", variant: "destructive" });
      return;
    }
    if (currentPassword === newPassword) {
      toast({ title: "Chagua nenosiri tofauti", description: "Nenosiri jipya lisifanane na la sasa.", variant: "destructive" });
      return;
    }

    setPasswordBusy(true);
    try {
      const { error } = await supabase.auth.updateUser({
        password: newPassword,
        current_password: currentPassword,
      });
      if (error) throw error;
      setCurrentPassword("");
      setNewPassword("");
      setConfirmNewPassword("");
      toast({ title: "Nenosiri limebadilishwa", description: "Mabadiliko haya yanahusu akaunti ya database hii pekee." });
    } catch (error) {
      toast({
        title: "Imeshindikana kubadili nenosiri",
        description: error instanceof Error ? error.message : "Jaribu tena.",
        variant: "destructive",
      });
    } finally {
      setPasswordBusy(false);
    }
  };

  const copyAccountId = async () => {
    if (!user?.id) return;
    try {
      await navigator.clipboard.writeText(user.id);
      toast({ title: "Account ID imenakiliwa" });
    } catch {
      toast({ title: "Imeshindikana kunakili ID", description: user.id });
    }
  };

  const handleSignOut = async () => {
    await signOut();
    navigate("/");
  };

  const settingSections = [
    { id: "general", icon: Gauge, label: "General settings", description: "Bubble, Data Saver na matumizi ya mtandao" },
    { id: "profile", icon: User, label: t("editProfile"), description: t("nameDesc") },
    { id: "notifications", icon: Bell, label: t("notifications"), description: t("notifDesc") },
    { id: "privacy", icon: Shield, label: t("privacy"), description: t("privacyDesc") },
    { id: "security", icon: KeyRound, label: "Usalama na nenosiri", description: "Account ID na kubadili nenosiri" },
    { id: "appearance", icon: Palette, label: t("appearance"), description: t("appearDesc") },
    { id: "chat-appearance", icon: MessageCircle, label: "Chat customization", description: "Chat backgrounds, message colors and text size" },
  ];

  const languages: { code: Language; label: string }[] = [
    { code: "en", label: t("english") },
    { code: "sw", label: t("kiswahili") },
  ];

  const renderSection = () => {
    switch (activeSection) {
      case "general":
        return (
          <div className="space-y-4 animate-fade-in">
            <div className="rounded-2xl border border-primary/20 bg-primary/5 px-3 py-1">
              <FloatingBubbleSettings />
              <SettingToggle label="Data Saver Mode" description="Punguza ubora na ukubwa wa picha wakati wa kuzitazama ili kutumia data kidogo. Video zitapakia metadata tu hadi ubonyeze Play." value={dataSaver} onChange={updateDataSaver} icon={<Gauge className="w-5 h-5" />} />
            </div>
            <p className="text-xs text-muted-foreground">Mipangilio hii huhifadhiwa kwenye kifaa hiki. Zima Data Saver ili kurudi kwenye ubora wa kawaida.</p>
          </div>
        );
      case "profile":
        return (
          <div className="space-y-6 animate-fade-in">
            <div className="flex flex-col items-center gap-4">
              <div className="relative">
                <div className="w-24 h-24 rounded-full bg-secondary flex items-center justify-center overflow-hidden">
                  {avatarUrl ? (
                    <img src={avatarUrl} alt="Avatar" className="w-full h-full object-cover" />
                  ) : (
                    <User className="w-10 h-10 text-muted-foreground" />
                  )}
                </div>
                <label className="absolute bottom-0 right-0 p-2 rounded-full bg-primary text-primary-foreground cursor-pointer hover:opacity-90 transition-opacity">
                  <Camera className="w-4 h-4" />
                  <input type="file" accept="image/*" onChange={uploadAvatar} className="hidden" />
                </label>
              </div>
              <p className="text-xs text-muted-foreground">{user?.email}</p>
            </div>
            <div className="space-y-3">
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">{t("displayName")}</label>
                <Input value={displayName} onChange={(e) => setDisplayName(e.target.value)} className="bg-surface border-border/50" />
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">{t("bio")}</label>
                <Textarea value={bio} onChange={(e) => setBio(e.target.value)} placeholder={t("bioPlaceholder")} className="bg-surface border-border/50 resize-none" rows={3} />
              </div>
              <Button onClick={updateProfile} disabled={loading} className="w-full neon-glow">
                {loading ? t("saving") : t("save")}
              </Button>
            </div>
          </div>
        );
      case "notifications":
        return (
          <div className="space-y-4 animate-fade-in">
            <Button variant="outline" disabled={pushBusy} onClick={async () => {
              if (!user) return;
              setPushBusy(true);
              setPushMessage("");
              try {
                if (isNativeAndroid && window.TigerNative) {
                  window.TigerNative.refreshFcmToken?.();
                  const tokenReady = await new Promise<boolean>((resolve) => {
                    const startedAt = Date.now();
                    const checkToken = () => {
                      if (window.TigerNative?.getFcmToken?.()) {
                        resolve(true);
                        return true;
                      }
                      if (Date.now() - startedAt >= 15000) {
                        resolve(false);
                        return true;
                      }
                      return false;
                    };
                    if (checkToken()) return;
                    const timer = window.setInterval(() => {
                      if (checkToken()) window.clearInterval(timer);
                    }, 500);
                  });
                  const status = window.TigerNative.getFcmStatus?.() || "No Firebase diagnostic was returned.";
                  setPushMessage(tokenReady
                    ? "Firebase token is ready. Android notification settings are opening; allow notifications there."
                    : status);
                  window.TigerNative.openNotificationSettings?.();
                  return;
                }
                const message = notifications ? (await disablePush(user.id), "Background notifications disabled on this device.") : await enablePush(user.id);
                setNotifications(isPushEnabled(user.id));
                setPushMessage(message);
              } catch (error) {
                toast({ title: "Notifications unavailable", description: error instanceof Error ? error.message : "Please try again", variant: "destructive" });
              } finally { setPushBusy(false); }
            }}><Bell className="mr-2 h-4 w-4" />{pushBusy ? "Checking Firebase…" : isNativeAndroid ? "Refresh token & notification settings" : notifications ? "Disable background notifications" : "Enable background notifications"}</Button>
            {pushMessage && <p role="status" className="text-sm text-muted-foreground">{pushMessage}</p>}
            {pushMessage.includes("own tab") && <Button variant="link" asChild><a href={window.location.href} target="_blank" rel="noopener noreferrer">Open in new tab</a></Button>}
            <div className="w-full min-w-0 rounded-2xl border border-primary/20 bg-primary/5 px-3 py-1">
              <SettingToggle label="Notifications enabled" description="Master switch for app notifications on this device" value={notificationPrefs.enabled} onChange={(v) => updateNotificationPreference({ enabled: v })} icon={<Bell className="h-5 w-5" />} />
              <SettingToggle label="Chat notifications" description="New direct and group messages" value={notificationPrefs.chat} onChange={(v) => updateNotificationPreference({ chat: v })} icon={<Mail className="h-5 w-5" />} />
              <SettingToggle label="Social notifications" description="Likes, comments, replies and new followers" value={notificationPrefs.social} onChange={(v) => updateNotificationPreference({ social: v })} icon={<User className="h-5 w-5" />} />
              <SettingToggle label="Notification sound" description="Play the selected incoming message ringtone" value={notificationPrefs.sound} onChange={(v) => updateNotificationPreference({ sound: v })} icon={<Volume2 className="h-5 w-5" />} />
              <SettingToggle label="Vibration" description="Short vibration for incoming foreground notifications when supported" value={notificationPrefs.vibration} onChange={(v) => updateNotificationPreference({ vibration: v })} icon={<Smartphone className="h-5 w-5" />} />
            </div>
            <div className="space-y-2">
              <label htmlFor="incoming-call-tone" className="text-sm font-medium text-foreground">Incoming call ringtone</label>
              <div className="flex w-full min-w-0 items-center gap-2">
                <select id="incoming-call-tone" value={incomingCallTone} onChange={(e) => updateTone("incoming_call", e.target.value as RingtoneId)} className="min-w-0 flex-1 rounded-xl border border-border bg-background px-3 py-2 text-sm text-foreground">
                  {ringtoneOptions.map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}
                </select>
                <Button type="button" variant="outline" size="sm" onClick={() => previewTone("incoming_call")} aria-label="Preview incoming call ringtone" className="shrink-0">
                  <Volume2 className="mr-1.5 h-4 w-4" />Preview
                </Button>
              </div>
            </div>
            <div className="space-y-2">
              <label htmlFor="incoming-sms-tone" className="text-sm font-medium text-foreground">Incoming SMS ringtone</label>
              <div className="flex w-full min-w-0 items-center gap-2">
                <select id="incoming-sms-tone" value={incomingSmsTone} onChange={(e) => updateTone("incoming_sms", e.target.value as RingtoneId)} className="min-w-0 flex-1 rounded-xl border border-border bg-background px-3 py-2 text-sm text-foreground">
                  {ringtoneOptions.map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}
                </select>
                <Button type="button" variant="outline" size="sm" onClick={() => previewTone("incoming_sms")} aria-label="Preview incoming SMS ringtone" className="shrink-0">
                  <Volume2 className="mr-1.5 h-4 w-4" />Preview
                </Button>
              </div>
            </div>
          </div>
        );
      case "privacy":
        return (
          <div className="space-y-4 animate-fade-in">
            <SettingToggle
              label="Private account"
              description="Only approved followers can see your posts"
              value={isPrivate}
              onChange={updatePrivacy}
              icon={<Lock className="w-5 h-5" />}
            />
            <SettingToggle label={t("readReceipts")} description={t("readReceiptsDesc")} value={readReceipts} onChange={setReadReceipts} />
            <SettingToggle label={t("lastSeen")} description={t("lastSeenDesc")} value={lastSeen} onChange={(value) => void updatePresencePrivacy("show_last_seen", value)} />
            <SettingToggle label="Online Status" description="Allow contacts to see the green online indicator while you are active." value={onlineStatus} onChange={(value) => void updatePresencePrivacy("show_online_status", value)} />
            {isWebAuthnSupported() && (
              <SettingToggle
                label="Biometric app lock"
                description="Require fingerprint / Face ID to open TIGERCHATS"
                value={appLock.enabled}
                onChange={toggleAppLock}
                icon={<Fingerprint className="w-5 h-5" />}
              />
            )}
            <TwoFactorSecurity />
          </div>
        );
      case "security":
        return (
          <div className="space-y-5 animate-fade-in">
            <div className="rounded-xl border border-border/60 bg-surface p-4 space-y-2">
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm font-semibold text-foreground">ID ya akaunti hii</p>
                <Button type="button" size="sm" variant="outline" onClick={copyAccountId} className="shrink-0">
                  <Copy className="mr-2 h-4 w-4" />Nakili ID
                </Button>
              </div>
              <p className="break-all font-mono text-xs text-muted-foreground">{user?.id || "Haipatikani"}</p>
              <p className="text-xs text-muted-foreground">Hii ni UUID ya kipekee ya akaunti yako kwenye database hii. Akaunti iliyo kwenye database nyingine ina ID yake tofauti.</p>
            </div>
            <div className="space-y-3">
              <div>
                <h3 className="text-sm font-semibold text-foreground">Badili nenosiri</h3>
                <p className="text-xs text-muted-foreground">Thibitisha nenosiri la sasa kabla ya kuweka jipya.</p>
              </div>
              <div className="space-y-1">
                <label htmlFor="current-password" className="text-xs text-muted-foreground">Nenosiri la sasa</label>
                <Input id="current-password" type="password" autoComplete="current-password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} className="bg-surface border-border/50" />
              </div>
              <div className="space-y-1">
                <label htmlFor="new-password" className="text-xs text-muted-foreground">Nenosiri jipya (angalau herufi/namba 8)</label>
                <Input id="new-password" type="password" autoComplete="new-password" minLength={8} value={newPassword} onChange={(e) => setNewPassword(e.target.value)} className="bg-surface border-border/50" />
              </div>
              <div className="space-y-1">
                <label htmlFor="confirm-new-password" className="text-xs text-muted-foreground">Rudia nenosiri jipya</label>
                <Input id="confirm-new-password" type="password" autoComplete="new-password" minLength={8} value={confirmNewPassword} onChange={(e) => setConfirmNewPassword(e.target.value)} className="bg-surface border-border/50" />
              </div>
              <Button type="button" onClick={changePassword} disabled={passwordBusy || !currentPassword || !newPassword || !confirmNewPassword} className="w-full neon-glow">
                <KeyRound className="mr-2 h-4 w-4" />{passwordBusy ? "Inabadilisha..." : "Hifadhi nenosiri jipya"}
              </Button>
              <p className="text-xs text-muted-foreground">Muhimu: kubadili nenosiri hapa kunabadilisha akaunti ya TigerChats kwenye database inayotumika sasa tu; hakuathiri nenosiri la database ya zamani.</p>
            </div>
          </div>
        );
      case "chat-appearance":
        return <ChatAppearanceSettings />;
      case "appearance":
        return (
          <div className="space-y-4 animate-fade-in">
            <SettingToggle
              label={theme === "dark" ? t("darkMode") : t("lightMode")}
              description={theme === "dark" ? t("useDarkTheme") : t("useLightTheme")}
              value={theme === "dark"}
              onChange={toggleTheme}
              icon={theme === "dark" ? <Moon className="w-5 h-5" /> : <Sun className="w-5 h-5" />}
            />
            <div className="pt-4 border-t border-border/50">
              <div className="flex min-w-0 items-center gap-3 mb-3">
                <Globe className="w-5 h-5 text-muted-foreground" />
                <p className="text-sm font-medium text-foreground">{t("language")}</p>
              </div>
              <div className="space-y-1">
                {languages.map((lang) => (
                  <button
                    key={lang.code}
                    onClick={() => setLanguage(lang.code)}
                    className={`w-full min-w-0 flex items-center justify-between gap-3 p-3 rounded-lg text-left transition-colors ${
                      language === lang.code ? "bg-primary/10 text-primary" : "hover:bg-surface-hover text-foreground"
                    }`}
                  >
                    <span className="text-sm">{lang.label}</span>
                    {language === lang.code && <div className="w-2 h-2 rounded-full bg-primary" />}
                  </button>
                ))}
              </div>
            </div>
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <div className="h-full overflow-y-auto bg-background">
      <div className="max-w-lg mx-auto">
        <div className="tiger-page-header glass sticky top-0 z-10">
          <button onClick={() => activeSection ? setActiveSection(null) : navigate("/")} className="tiger-header-action hover:bg-surface-hover hover:text-foreground" aria-label="Back">
            <ArrowLeft className="w-5 h-5 text-foreground" />
          </button>
          <h1 className="min-w-0 truncate text-lg font-bold text-foreground">
            {activeSection ? settingSections.find(s => s.id === activeSection)?.label : t("settings")}
          </h1>
        </div>

        {activeSection ? (
          <div className="p-4">{renderSection()}</div>
        ) : (
          <div className="p-4 space-y-2">
            <div className="glass rounded-2xl p-4 flex items-center gap-4 mb-4">
              <div className="w-16 h-16 rounded-full bg-secondary flex items-center justify-center overflow-hidden">
                {avatarUrl ? (
                  <img src={avatarUrl} alt="Avatar" className="w-full h-full object-cover" />
                ) : (
                  <img src={tigerLogo} alt="Profile" className="w-12 h-12" width={512} height={512} />
                )}
              </div>
              <div className="flex-1">
                <h2 className="font-semibold text-foreground">{displayName || "Set your name"}</h2>
                <p className="text-xs text-muted-foreground">{user?.email}</p>
              </div>
            </div>

            <div className="rounded-xl border border-primary/30 bg-gradient-to-r from-primary/10 via-card to-accent/10 p-4 flex items-center gap-3 shadow-sm">
              <div className="w-11 h-11 rounded-xl bg-primary/15 flex items-center justify-center">
                {appInstalled ? <Smartphone className="w-5 h-5 text-primary" /> : <Download className="w-5 h-5 text-primary" />}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-foreground">Install TIGERCHATS</p>
                <p className="text-xs text-muted-foreground">{appInstalled ? "App tayari imewekwa kwenye kifaa hiki" : "Weka app kwenye Home Screen kwa ufikiaji wa haraka"}</p>
              </div>
              <Button size="sm" onClick={installApp} disabled={appInstalled} className="shrink-0 gap-1.5">
                <Download className="w-4 h-4" />{appInstalled ? "Installed" : "Install"}
              </Button>
            </div>

            <AndroidUpdateChecker />

            {settingSections.map((section) => (
              <button key={section.id} onClick={() => setActiveSection(section.id)} className="w-full flex items-center gap-4 p-4 glass rounded-xl hover:bg-surface-hover transition-colors text-left">
                <div className="w-10 h-10 rounded-full bg-surface flex items-center justify-center">
                  <section.icon className="w-5 h-5 text-primary" />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium text-foreground">{section.label}</p>
                  <p className="text-xs text-muted-foreground">{section.description}</p>
                </div>
                <ChevronRight className="w-4 h-4 text-muted-foreground" />
              </button>
            ))}

            <div className="pt-4 space-y-2">
              <Button variant="outline" onClick={() => navigate("/contact")} className="w-full justify-start h-12"><Mail className="w-5 h-5 mr-3 text-primary" />Contact admin</Button>
              <button onClick={handleSignOut} className="w-full flex items-center gap-4 p-4 glass rounded-xl hover:bg-destructive/10 transition-colors text-left">
                <div className="w-10 h-10 rounded-full bg-destructive/10 flex items-center justify-center">
                  <LogOut className="w-5 h-5 text-destructive" />
                </div>
                <span className="text-sm font-medium text-destructive">{t("signOut")}</span>
              </button>
            </div>

            <div className="text-center py-6 space-y-1">
              <img src={tigerLogo} alt="TIGERCHATS" className="w-10 h-10 mx-auto opacity-30" width={512} height={512} />
              <p className="text-xs text-muted-foreground">TIGERCHATS v1.0</p>
              <p className="text-[10px] text-muted-foreground">{t("encrypted")}</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Settings;
