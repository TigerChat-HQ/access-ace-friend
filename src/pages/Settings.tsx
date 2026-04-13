import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import {
  ArrowLeft, Camera, User, Bell, Shield, Palette, LogOut,
  ChevronRight, Moon, Globe, Lock, Trash2
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import tigerLogo from "@/assets/tigerchats-logo.png";

const Settings = () => {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [displayName, setDisplayName] = useState("");
  const [bio, setBio] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [activeSection, setActiveSection] = useState<string | null>(null);

  // Settings state
  const [notifications, setNotifications] = useState(true);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [readReceipts, setReadReceipts] = useState(true);
  const [lastSeen, setLastSeen] = useState(true);
  const [darkMode, setDarkMode] = useState(true);

  useEffect(() => {
    if (user) loadProfile();
  }, [user]);

  const loadProfile = async () => {
    const { data } = await supabase
      .from("profiles")
      .select("*")
      .eq("user_id", user!.id)
      .single();
    if (data) {
      setDisplayName(data.display_name || "");
      setBio(data.bio || "");
      setAvatarUrl(data.avatar_url || "");
    }
  };

  const updateProfile = async () => {
    setLoading(true);
    const { error } = await supabase
      .from("profiles")
      .update({ display_name: displayName, bio })
      .eq("user_id", user!.id);

    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Profile updated! ✅" });
    }
    setLoading(false);
  };

  const uploadAvatar = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const filePath = `${user!.id}/${Date.now()}.${file.name.split('.').pop()}`;
    const { error: uploadError } = await supabase.storage
      .from("avatars")
      .upload(filePath, file);

    if (uploadError) {
      toast({ title: "Upload failed", description: uploadError.message, variant: "destructive" });
      return;
    }

    const { data: { publicUrl } } = supabase.storage.from("avatars").getPublicUrl(filePath);

    await supabase
      .from("profiles")
      .update({ avatar_url: publicUrl })
      .eq("user_id", user!.id);

    setAvatarUrl(publicUrl);
    toast({ title: "Avatar updated! 📸" });
  };

  const handleSignOut = async () => {
    await signOut();
    navigate("/");
  };

  const settingSections = [
    {
      id: "profile",
      icon: User,
      label: "Edit Profile",
      description: "Name, bio, avatar",
    },
    {
      id: "notifications",
      icon: Bell,
      label: "Notifications",
      description: "Push, sound, alerts",
    },
    {
      id: "privacy",
      icon: Shield,
      label: "Privacy & Security",
      description: "Read receipts, last seen",
    },
    {
      id: "appearance",
      icon: Palette,
      label: "Appearance",
      description: "Theme, language",
    },
  ];

  const renderSection = () => {
    switch (activeSection) {
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
                <label className="text-xs text-muted-foreground mb-1 block">Display Name</label>
                <Input
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  className="bg-surface border-border/50"
                />
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Bio</label>
                <Textarea
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  placeholder="Tell people about yourself..."
                  className="bg-surface border-border/50 resize-none"
                  rows={3}
                />
              </div>
              <Button onClick={updateProfile} disabled={loading} className="w-full neon-glow">
                {loading ? "Saving..." : "Save Changes"}
              </Button>
            </div>
          </div>
        );
      case "notifications":
        return (
          <div className="space-y-4 animate-fade-in">
            <SettingToggle label="Push Notifications" description="Receive push notifications" value={notifications} onChange={setNotifications} />
            <SettingToggle label="Sound" description="Play sound for new messages" value={soundEnabled} onChange={setSoundEnabled} />
          </div>
        );
      case "privacy":
        return (
          <div className="space-y-4 animate-fade-in">
            <SettingToggle label="Read Receipts" description="Let others know you've read messages" value={readReceipts} onChange={setReadReceipts} />
            <SettingToggle label="Last Seen" description="Show when you were last active" value={lastSeen} onChange={setLastSeen} />
            <div className="pt-4 border-t border-border/50">
              <button className="flex items-center gap-3 w-full py-3 text-left">
                <Lock className="w-5 h-5 text-muted-foreground" />
                <div className="flex-1">
                  <p className="text-sm font-medium text-foreground">Two-Factor Authentication</p>
                  <p className="text-xs text-muted-foreground">Add extra security to your account</p>
                </div>
                <ChevronRight className="w-4 h-4 text-muted-foreground" />
              </button>
            </div>
          </div>
        );
      case "appearance":
        return (
          <div className="space-y-4 animate-fade-in">
            <SettingToggle label="Dark Mode" description="Use dark theme" value={darkMode} onChange={setDarkMode} icon={<Moon className="w-5 h-5" />} />
            <button className="flex items-center gap-3 w-full py-3 text-left">
              <Globe className="w-5 h-5 text-muted-foreground" />
              <div className="flex-1">
                <p className="text-sm font-medium text-foreground">Language</p>
                <p className="text-xs text-muted-foreground">English</p>
              </div>
              <ChevronRight className="w-4 h-4 text-muted-foreground" />
            </button>
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-lg mx-auto">
        {/* Header */}
        <div className="flex items-center gap-3 px-4 py-4 border-b border-border/50 glass sticky top-0 z-10">
          <button onClick={() => activeSection ? setActiveSection(null) : navigate("/")} className="p-1 hover:bg-surface-hover rounded-full transition-colors">
            <ArrowLeft className="w-5 h-5 text-foreground" />
          </button>
          <h1 className="text-lg font-bold text-foreground">
            {activeSection ? settingSections.find(s => s.id === activeSection)?.label : "Settings"}
          </h1>
        </div>

        {activeSection ? (
          <div className="p-4">{renderSection()}</div>
        ) : (
          <div className="p-4 space-y-2">
            {/* Profile Card */}
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

            {/* Setting Sections */}
            {settingSections.map((section) => (
              <button
                key={section.id}
                onClick={() => setActiveSection(section.id)}
                className="w-full flex items-center gap-4 p-4 glass rounded-xl hover:bg-surface-hover transition-colors text-left"
              >
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

            {/* Danger Zone */}
            <div className="pt-4 space-y-2">
              <button
                onClick={handleSignOut}
                className="w-full flex items-center gap-4 p-4 glass rounded-xl hover:bg-destructive/10 transition-colors text-left"
              >
                <div className="w-10 h-10 rounded-full bg-destructive/10 flex items-center justify-center">
                  <LogOut className="w-5 h-5 text-destructive" />
                </div>
                <span className="text-sm font-medium text-destructive">Sign Out</span>
              </button>
            </div>

            {/* App Info */}
            <div className="text-center py-6 space-y-1">
              <img src={tigerLogo} alt="TIGERCHATS" className="w-10 h-10 mx-auto opacity-30" width={512} height={512} />
              <p className="text-xs text-muted-foreground">TIGERCHATS v1.0</p>
              <p className="text-[10px] text-muted-foreground">End-to-end encrypted</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

const SettingToggle = ({
  label,
  description,
  value,
  onChange,
  icon,
}: {
  label: string;
  description: string;
  value: boolean;
  onChange: (v: boolean) => void;
  icon?: React.ReactNode;
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

export default Settings;
