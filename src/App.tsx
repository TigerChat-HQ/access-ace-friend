import { lazy, Suspense } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, Navigate } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { ThemeProvider } from "@/contexts/ThemeContext";
import { LanguageProvider } from "@/contexts/LanguageContext";
import { AppShell } from "@/components/AppShell";
const Feed = lazy(() => import("./pages/Feed"));
const Reels = lazy(() => import("./pages/Reels"));
const ReelsStudio = lazy(() => import("./pages/ReelsStudio"));
const ProfessionalDashboard = lazy(() => import("./pages/ProfessionalDashboard"));
const Search = lazy(() => import("./pages/Search"));
const Create = lazy(() => import("./pages/Create"));
const Chats = lazy(() => import("./pages/Chats"));
const Groups = lazy(() => import("./pages/Groups"));
const Profile = lazy(() => import("./pages/Profile"));
const PostDetail = lazy(() => import("./pages/PostDetail"));
const SavedPosts = lazy(() => import("./pages/SavedPosts"));
const ArchivedPosts = lazy(() => import("./pages/ArchivedPosts"));
const PostCollections = lazy(() => import("./pages/PostCollections"));
const PostCollaborations = lazy(() => import("./pages/PostCollaborations"));
const Admin = lazy(() => import("./pages/Admin"));
const Notifications = lazy(() => import("./pages/Notifications"));
const Auth = lazy(() => import("./pages/Auth"));
const Settings = lazy(() => import("./pages/Settings"));
const ForgotPassword = lazy(() => import("./pages/ForgotPassword"));
const ResetPassword = lazy(() => import("./pages/ResetPassword"));
const Install = lazy(() => import("./pages/Install"));
const NotFound = lazy(() => import("./pages/NotFound"));
const TigerAI = lazy(() => import("./pages/TigerAI"));
const Game = lazy(() => import("./pages/Game"));
const GamesHub = lazy(() => import("./pages/GamesHub"));
const UnblockGame = lazy(() => import("./pages/UnblockGame"));
const ConnectFour = lazy(() => import("./pages/ConnectFour"));
const BlockPuzzle = lazy(() => import("./pages/BlockPuzzle"));
const Draughts = lazy(() => import("./pages/Draughts"));
const DraughtsTournaments = lazy(() => import("./pages/DraughtsTournaments"));
const DraughtsRewards = lazy(() => import("./pages/DraughtsRewards"));
const DraughtsReplay = lazy(() => import("./pages/DraughtsReplay"));
const DraughtsWatch = lazy(() => import("./pages/DraughtsWatch"));
const Contact = lazy(() => import("./pages/Contact"));
const PublicDraughts = lazy(() => import("./pages/PublicDraughts"));
import { HelmetProvider } from "react-helmet-async";
import { TwoFactorGate } from "@/components/TwoFactorSecurity";
const queryClient = new QueryClient();
const Spinner = () => <div className="tiger-app-safe-area min-h-screen bg-background px-4 py-5" role="status" aria-label="Loading TigerChat"><div className="mx-auto max-w-2xl space-y-4"><div className="flex items-center gap-3 pb-3"><div className="h-10 w-10 animate-pulse rounded-xl bg-primary/20" /><div className="h-4 w-32 animate-pulse rounded bg-muted" /></div><div className="h-36 animate-pulse rounded-2xl bg-muted/80" /><div className="flex gap-3">{[0,1,2,3,4].map((item) => <div key={item} className="h-12 min-w-0 flex-1 animate-pulse rounded-full bg-muted" />)}</div>{[0,1,2].map((item) => <div key={item} className="space-y-3 rounded-2xl border border-border/50 p-4"><div className="h-3 w-28 animate-pulse rounded bg-muted" /><div className="h-3 w-full animate-pulse rounded bg-muted" /><div className="h-32 animate-pulse rounded-xl bg-muted/70" /></div>)}</div><span className="sr-only">TigerChat is loading</span></div>;
const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { user, loading } = useAuth();
  if (loading) return <Spinner />;
  if (!user) return <Navigate to="/auth" replace />;
  return <>{children}</>;
};
const AuthRoute = ({ children }: { children: React.ReactNode }) => {
  const { user, loading } = useAuth();
  if (loading) return <Spinner />;
  if (user) return <Navigate to="/" replace />;
  return <>{children}</>;
};
const App = () => <HelmetProvider><QueryClientProvider client={queryClient}><ThemeProvider><LanguageProvider><AuthProvider><TooltipProvider><Toaster /><Sonner /><TwoFactorGate><BrowserRouter><Suspense fallback={<Spinner />}><Routes>
  <Route path="/auth" element={<AuthRoute><Auth /></AuthRoute>} />
  <Route path="/forgot-password" element={<ForgotPassword />} /><Route path="/reset-password" element={<ResetPassword />} /><Route path="/install" element={<Install />} /><Route path="/tanzanian-draft-game" element={<PublicDraughts />} /><Route path="/contact" element={<Contact />} />
  <Route element={<ProtectedRoute><AppShell /></ProtectedRoute>}>
    <Route path="/" element={<Feed />} /><Route path="/reels" element={<Reels />} /><Route path="/reels/studio" element={<ReelsStudio />} /><Route path="/creator" element={<ProfessionalDashboard />} /><Route path="/search" element={<Search />} /><Route path="/create" element={<Create />} /><Route path="/chats" element={<Chats />} /><Route path="/groups" element={<Groups />} />
    <Route path="/stories" element={<Navigate to="/" replace />} /><Route path="/u/:userId" element={<Profile />} /><Route path="/profile/:userId" element={<Profile />} /><Route path="/@:userId" element={<Profile />} /><Route path="/post/:postId" element={<PostDetail />} /><Route path="/saved" element={<SavedPosts />} /><Route path="/saved/collections" element={<PostCollections />} /><Route path="/collaborations" element={<PostCollaborations />} /><Route path="/archive" element={<ArchivedPosts />} /><Route path="/admin" element={<Admin />} /><Route path="/notifications" element={<Notifications />} /><Route path="/settings" element={<Settings />} /><Route path="/tiger-ai" element={<TigerAI />} /><Route path="/game" element={<Game />} /><Route path="/games" element={<GamesHub />} /><Route path="/games/unblock" element={<UnblockGame />} /><Route path="/games/connect-four" element={<ConnectFour />} /><Route path="/games/block-puzzle" element={<BlockPuzzle />} /><Route path="/draughts" element={<Draughts />} /><Route path="/draughts/tournaments" element={<DraughtsTournaments />} /><Route path="/draughts/rewards" element={<DraughtsRewards />} /><Route path="/draughts/replay/:matchId" element={<DraughtsReplay />} /><Route path="/draughts/watch" element={<DraughtsWatch />} /><Route path="/draughts/watch/:matchId" element={<DraughtsWatch />} />
  </Route><Route path="*" element={<NotFound />} />
</Routes></Suspense></BrowserRouter></TwoFactorGate></TooltipProvider></AuthProvider></LanguageProvider></ThemeProvider></QueryClientProvider></HelmetProvider>;
export default App;
