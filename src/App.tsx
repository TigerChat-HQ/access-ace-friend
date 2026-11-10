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
const Draughts = lazy(() => import("./pages/Draughts"));
const DraughtsTournaments = lazy(() => import("./pages/DraughtsTournaments"));
const Contact = lazy(() => import("./pages/Contact"));
const PublicDraughts = lazy(() => import("./pages/PublicDraughts"));
import { HelmetProvider } from "react-helmet-async";
import { TwoFactorGate } from "@/components/TwoFactorSecurity";
const queryClient = new QueryClient();
const Spinner = () => <div className="min-h-screen flex items-center justify-center bg-background"><div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" /></div>;
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
    <Route path="/stories" element={<Navigate to="/" replace />} /><Route path="/u/:userId" element={<Profile />} /><Route path="/profile/:userId" element={<Profile />} /><Route path="/@:userId" element={<Profile />} /><Route path="/post/:postId" element={<PostDetail />} /><Route path="/admin" element={<Admin />} /><Route path="/notifications" element={<Notifications />} /><Route path="/settings" element={<Settings />} /><Route path="/tiger-ai" element={<TigerAI />} /><Route path="/game" element={<Game />} /><Route path="/draughts" element={<Draughts />} /><Route path="/draughts/tournaments" element={<DraughtsTournaments />} />
  </Route><Route path="*" element={<NotFound />} />
</Routes></Suspense></BrowserRouter></TwoFactorGate></TooltipProvider></AuthProvider></LanguageProvider></ThemeProvider></QueryClientProvider></HelmetProvider>;
export default App;
