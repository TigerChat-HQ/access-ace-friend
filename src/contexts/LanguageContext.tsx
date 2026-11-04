/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useState, ReactNode } from "react";

export type Language = "en" | "sw";

const translations: Record<Language, Record<string, string>> = {
  en: {
    settings: "Settings",
    editProfile: "Edit Profile",
    notifications: "Notifications",
    privacy: "Privacy & Security",
    appearance: "Appearance",
    language: "Language",
    darkMode: "Dark Mode",
    lightMode: "Light Mode",
    signOut: "Sign Out",
    save: "Save Changes",
    saving: "Saving...",
    displayName: "Display Name",
    bio: "Bio",
    bioPlaceholder: "Tell people about yourself...",
    pushNotifications: "Push Notifications",
    pushDesc: "Receive push notifications",
    sound: "Sound",
    soundDesc: "Play sound for new messages",
    readReceipts: "Read Receipts",
    readReceiptsDesc: "Let others know you've read messages",
    lastSeen: "Last Seen",
    lastSeenDesc: "Show when you were last active",
    twoFactor: "Two-Factor Authentication",
    twoFactorDesc: "Add extra security to your account",
    useDarkTheme: "Use dark theme",
    useLightTheme: "Use light theme",
    english: "English",
    kiswahili: "Kiswahili",
    profileUpdated: "Profile updated! ✅",
    avatarUpdated: "Avatar updated! 📸",
    uploadFailed: "Upload failed",
    error: "Error",
    nameDesc: "Name, bio, avatar",
    notifDesc: "Push, sound, alerts",
    privacyDesc: "Read receipts, last seen",
    appearDesc: "Theme, language",
    searchChats: "Search chats...",
    noConversations: "No conversations yet",
    startNewChat: "Start a new chat to get going!",
    online: "online",
    lastSeenRecently: "last seen recently",
    encrypted: "End-to-end encrypted",
    welcome: "Welcome to",
    welcomeDesc: "Fast like lightning. Secure like a vault. Select a chat to start messaging.",
    newGroup: "New Group",
    groupName: "Group Name",
    createGroup: "Create Group",
    members: "Members",
    addMembers: "Add Members",
    groupChat: "Group Chat",
  },
  sw: {
    settings: "Mipangilio",
    editProfile: "Hariri Wasifu",
    notifications: "Arifa",
    privacy: "Faragha na Usalama",
    appearance: "Muonekano",
    language: "Lugha",
    darkMode: "Hali ya Giza",
    lightMode: "Hali ya Mwanga",
    signOut: "Toka",
    save: "Hifadhi Mabadiliko",
    saving: "Inahifadhi...",
    displayName: "Jina la Kuonyesha",
    bio: "Maelezo",
    bioPlaceholder: "Waambie watu kuhusu wewe...",
    pushNotifications: "Arifa za Push",
    pushDesc: "Pokea arifa za push",
    sound: "Sauti",
    soundDesc: "Cheza sauti kwa ujumbe mpya",
    readReceipts: "Risiti za Kusoma",
    readReceiptsDesc: "Waache wengine wajue umesoma ujumbe",
    lastSeen: "Ulionekana Mwisho",
    lastSeenDesc: "Onyesha ulipokuwa hai mwisho",
    twoFactor: "Uthibitishaji wa Hatua Mbili",
    twoFactorDesc: "Ongeza usalama zaidi kwenye akaunti yako",
    useDarkTheme: "Tumia mandhari ya giza",
    useLightTheme: "Tumia mandhari ya mwanga",
    english: "Kiingereza",
    kiswahili: "Kiswahili",
    profileUpdated: "Wasifu umesasishwa! ✅",
    avatarUpdated: "Picha imesasishwa! 📸",
    uploadFailed: "Kupakia kumeshindikana",
    error: "Kosa",
    nameDesc: "Jina, maelezo, picha",
    notifDesc: "Push, sauti, arifa",
    privacyDesc: "Risiti za kusoma, mwisho kuonekana",
    appearDesc: "Mandhari, lugha",
    searchChats: "Tafuta mazungumzo...",
    noConversations: "Hakuna mazungumzo bado",
    startNewChat: "Anza mazungumzo mapya!",
    online: "mtandaoni",
    lastSeenRecently: "alionekana hivi karibuni",
    encrypted: "Imesimbwa kwa njia ya mwisho-hadi-mwisho",
    welcome: "Karibu kwenye",
    welcomeDesc: "Haraka kama umeme. Salama kama kabati la siri. Chagua mazungumzo kuanza kutuma ujumbe.",
    newGroup: "Kundi Jipya",
    groupName: "Jina la Kundi",
    createGroup: "Unda Kundi",
    members: "Wanachama",
    addMembers: "Ongeza Wanachama",
    groupChat: "Mazungumzo ya Kundi",
  },
};

interface LanguageContextType {
  language: Language;
  setLanguage: (l: Language) => void;
  t: (key: string) => string;
}

const LanguageContext = createContext<LanguageContextType>({
  language: "en",
  setLanguage: () => {},
  t: (key) => key,
});

export const useLanguage = () => useContext(LanguageContext);

export const LanguageProvider = ({ children }: { children: ReactNode }) => {
  const [language, setLanguageState] = useState<Language>(() => {
    return (localStorage.getItem("tigerchats-lang") as Language) || "en";
  });

  const setLanguage = (l: Language) => {
    setLanguageState(l);
    localStorage.setItem("tigerchats-lang", l);
  };

  const t = (key: string) => translations[language][key] || key;

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  );
};
