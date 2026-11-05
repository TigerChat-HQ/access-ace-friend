import { useState, useEffect, useRef } from "react";
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
  ArrowLeft, Camera, User, Bell, Shield, Palette, LogOut,
  ChevronRight, Moon, Sun, Globe, Lock, Fingerprint, Mail, Volume2,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useAppLock, isWebAuthnSupported } from "@/hooks/useAppLock";
import tigerLogo from "@/assets/tigerchats-logo.png";
import { ringtoneOptions, getStoredRingtone, setStoredRingtone, playRingtone, type RingtoneId } from "@/lib/ringtones";

const SettingToggle = ({
  label, description, value, onChange, icon,
}: {
  label: string; description: string; value: boolean;
  onChange: (v: boolean) => void; icon?: React.ReactNode;
}) => (
  <div className="flex items-center justify-between py-3">
    <div className="flex items-center gap-3">
      {icon && <span className="text-muted-foreground">{icon}</span>}
      <div>
        <p className="text-sm font-medium text-foreground">{label}</p>
        <p className="text-xs text-muted-foreground">{description}</p>
      </div>
    </div>
    <Switch checked={value} onCheckedChange={onChange} />
  </div>
);

const Settings = () => {
  const { user, signOut } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const { language, setLanguage, t } = useLanguage();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [displayName, setDisplayName] = useState("");
  const [bio, setBio] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [activeSection, setActiveSection] = useState<string | null>(null);
  const [notifications, setNotifications] = useState(true);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [readReceipts, setReadReceipts] = useState(true);
  const [lastSeen, setLastSeen] = useState(true);
  const [isPrivate, setIsPrivate] = useState(false);
  const [incomingCallTone, setIncomingCallTone] = useState<RingtoneId>(() => getStoredRingtone("incoming_call"));
  const [incomingSmsTone, setIncomingSmsTone] = useState<RingtoneId>(() => getStoredRingtone("incoming_sms"));
  const previewStopRef = useRef<(() => void) | null>(null);
  const previewTimerRef = useRef<number | null>(null);
  const appLock = useAppLock();

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

  const toggleAppLock = async (v: boolean) => {
    try {
      if (v) {
        const ok = await appLock.enable();
        if (ok) toast({ title: "App lock enabled" });
      } else {
        appLock.disable();
        toast({ title: "App lock disabled" });
      }
    } catch (e: any) {
      toast({ title: "Failed", description: e?.message || "Could not enable", variant: "destructive" });
    }
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
      setIsPrivate((data as any).is_private || false);
    }
  };

  const updatePrivacy = async (v: boolean) => {
    setIsPrivate(v);
    const { error } = await supabase
      .from("profiles").update({ is_private: v } as any).eq("user_id", user!.id);
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

  const handleSignOut = async () => {
    await signOut();
    navigate("/");
  };

  const updateTone = (kind: "incoming_call" | "incoming_sms", value: RingtoneId) => {
    setStoredRingtone(kind, value);
    if (kind === "incoming_call") setIncomingCallTone(value);
    else setIncomingSmsTone(value);
  };

  const settingSections = [
    { id: "profile", icon: User, label: t("editProfile"), description: t("nameDesc") },
    { id: "notifications", icon: Bell, label: t("notifications"), description: t("notifDesc") },
    { id: "privacy", icon: Shield, label: t("privacy"), description: t("privacyDesc") },
    { id: "appearance", icon: Palette, label: t("appearance"), description: t("appearDesc") },
  ];

  const languages: { code: Language; label: string }[] = [
    { code: "en", label: t("english") },
    { code: "sw", label: t("kiswahili") },
  ];

  const renderSection = () => {
    switch (activeSection) {
      case "profile":
        return (
          <div className="space-y-6 animate-fade-in">
            <div className="flex flex-col items-center gap-4">
              <div className="relative">
                <div className="w-24 h-24 rounded-full bg-secondary flex items-center justify-center overflow-hidden">
                  {avatarUrl ? <img src={avatarUrl} alt="Avatar" className="w-full h-full object-cover" /> : <User className="w-10 h-10 text-muted-foreground" />}
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
              <Button onClick={updateProfile} disabled={loading} className="w-full neon-glow">{loading ? t("saving") : t("save")}</Button>
            </div>
          </div>
        );
      case "notifications":
        return (
          <div className="space-y-4 animate-fade-in">
            <SettingToggle label={t("pushNotifications")} description={t("pushDesc")} value={notifications} onChange={setNotifications} />
            <SettingToggle label={t("sound")} description={t("soundDesc")} value={soundEnabled} onChange={setSoundEnabled} />
            <div className="space-y-2">
              <label htmlFor="incoming-call-tone" className="text-sm font-medium text-foreground">Incoming call ringtone</label>
              <div className="flex items-center gap-2">
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
              <div className="flex items-center gap-2">
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
            <SettingToggle label="Private account" description="Only approved followers can see your posts" value={isPrivate} onChange={updatePrivacy} icon={<Lock className="w-5 h-5" />} />
            <SettingToggle label={t("readReceipts")} description={t("readReceiptsDesc")} value={readReceipts} onChange={setReadReceipts} />
            <SettingToggle label={t("lastSeen")} description={t("lastSeenDesc")} value={lastSeen} onChange={setLastSeen} />
            {isWebAuthnSupported() && <SettingToggle label="Biometric app lock" description="Require fingerprint / Face ID to open TIGERCHATS" value={appLock.enabled} onChange={toggleAppLock} icon={<Fingerprint className="w-5 h-5" />} />}
            <div className="pt-4 border-t border-border/50">
              <button className="flex items-center gap-3 w-full py-3 text-left">
                <Lock className="w-5 h-5 text-muted-foreground" />
                <div className="flex-1"><p className="text-sm font-medium text-foreground">{t("twoFactor")}</p><p className="text-xs text-muted-foreground">{t("twoFactorDesc")}</p></div>
                <ChevronRight className="w-4 h-4 text-muted-foreground" />
              </button>
            </div>
          </div>
        );
      case "appearance":
        return (
          <div className="space-y-4 animate-fade-in">
            <SettingToggle label={theme === "dark" ? t("darkMode") : t("lightMode")} description={theme === "dark" ? t("useDarkTheme") : t("useLightTheme")} value={theme === "dark"} onChange={toggleTheme} icon={theme === "dark" ? <Moon className="w-5 h-5" /> : <Sun className="w-5 h-5" />} />
            <div className="pt-4 border-t border-border/50">
              <div className="flex items-center gap-3 mb-3"><Globe className="w-5 h-5 text-muted-foreground" /><p className="text-sm font-medium text-foreground">{t("language")}</p></div>
              <div className="space-y-1">
                {languages.map((lang) => <button key={lang.code} onClick={() => setLanguage(lang.code)} className={`w-full flex items-center justify-between p-3 rounded-lg transition-colors ${language === lang.code ? "bg-primary/10 text-primary" : "hover:bg-surface-hover text-foreground"}`}><span className="text-sm">{lang.label}</span>{language === lang.code && <div className="w-2 h-2 rounded-full bg-primary" />}</button>)}
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
        <div className="flex items-center gap-3 px-4 py-4 border-b border-border/50 glass sticky top-0 z-10">
          <button onClick={() => activeSection ? setActiveSection(null) : navigate("/")} className="p-1 hover:bg-surface-hover rounded-full transition-colors"><ArrowLeft className="w-5 h-5 text-foreground" /></button>
          <h1 className="text-lg font-bold text-foreground">{activeSection ? settingSections.find(s => s.id === activeSection)?.label : t("settings")}</h1>
        </div>

        {activeSection ? <div className="p-4">{renderSection()}</div> : (
          <div className="p-4 space-y-2">
            <div className="glass rounded-2xl p-4 flex items-center gap-4 mb-4">
              <div className="w-16 h-16 rounded-full bg-secondary flex items-center justify-center overflow-hidden">{avatarUrl ? <img src={avatarUrl} alt="Avatar" className="w-full h-full object-cover" /> : <img src={tigerLogo} alt="Profile" className="w-12 h-12" width={512} height={512} />}</div>
              <div className="flex-1"><h2 className="font-semibold text-foreground">{displayName || "Set your name"}</h2><p className="text-xs text-muted-foreground">{user?.email}</p></div>
            </div>

            {settingSections.map((section) => <button key={section.id} onClick={() => setActiveSection(section.id)} className="w-full flex items-center gap-4 p-4 glass rounded-xl hover:bg-surface-hover transition-colors text-left"><div className="w-10 h-10 rounded-full bg-surface flex items-center justify-center"><section.icon className="w-5 h-5 text-primary" /></div><div className="flex-1"><p className="text-sm font-medium text-foreground">{section.label}</p><p className="text-xs text-muted-foreground">{section.description}</p></div><ChevronRight className="w-4 h-4 text-muted-foreground" /></button>)}

            <div className="pt-4 space-y-2">
              <Button variant="outline" onClick={() => navigate("/contact")} className="w-full justify-start h-12"><Mail className="w-5 h-5 mr-3 text-primary" />Contact admin</Button>
              <button onClick={handleSignOut} className="w-full flex items-center gap-4 p-4 glass rounded-xl hover:bg-destructive/10 transition-colors text-left"><div className="w-10 h-10 rounded-full bg-destructive/10 flex items-center justify-center"><LogOut className="w-5 h-5 text-destructive" /></div><span className="text-sm font-medium text-destructive">{t("signOut")}</span></button>
            </div>
            <div className="text-center py-6 space-y-1"><img src={tigerLogo} alt="TIGERCHATS" className="w-10 h-10 mx-auto opacity-30" width={512} height={512} /><p className="text-xs text-muted-foreground">TIGERCHATS v1.0</p><p className="text-[10px] text-muted-foreground">{t("encrypted")}</p></div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Settings;
