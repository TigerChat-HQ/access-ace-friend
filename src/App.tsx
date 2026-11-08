import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, Navigate } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { ThemeProvider } from "@/contexts/ThemeContext";
import { LanguageProvider } from "@/contexts/LanguageContext";
import { AppShell } from "@/components/AppShell";
import Feed from "./pages/Feed";
import Search from "./pages/Search";
import Create from "./pages/Create";
import Chats from "./pages/Chats";
import Groups from "./pages/Groups";
import Stories from "./pages/Stories";
import Profile from "./pages/Profile";
import PostDetail from "./pages/PostDetail";
import Admin from "./pages/Admin";
import Notifications from "./pages/Notifications";
import Auth from "./pages/Auth";
import Settings from "./pages/Settings";
import ForgotPassword from "./pages/ForgotPassword";
import ResetPassword from "./pages/ResetPassword";
import Install from "./pages/Install";
import NotFound from "./pages/NotFound";
import TigerAI from "./pages/TigerAI";
import Game from "./pages/Game";
import Draughts from "./pages/Draughts";
import Contact from "./pages/Contact";
import PublicDraughts from "./pages/PublicDraughts";
import { HelmetProvider } from "react-helmet-async";
import { TwoFactorGate } from "@/components/TwoFactorSecurity";
import { PWAInstallBanner } from "@/components/PWAInstallBanner";

const queryClient = new QueryClient();

const Spinner = () => (
  <div className="min-h-screen flex items-center justify-center bg-background">
    <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
  </div>
);

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

const App = () => (
  <HelmetProvider>
  <QueryClientProvider client={queryClient}>
    <ThemeProvider>
      <LanguageProvider>
        <AuthProvider>
          <TooltipProvider>
            <Toaster />
            <Sonner />
            <TwoFactorGate><BrowserRouter>
              <PWAInstallBanner />
              <Routes>
                <Route path="/auth" element={<AuthRoute><Auth /></AuthRoute>} />
                <Route path="/forgot-password" element={<ForgotPassword />} />
                <Route path="/reset-password" element={<ResetPassword />} />
                <Route path="/install" element={<Install />} />
                <Route path="/tanzanian-draft-game" element={<PublicDraughts />} />
                <Route path="/contact" element={<Contact />} />

                <Route element={<ProtectedRoute><AppShell /></ProtectedRoute>}>
                  <Route path="/" element={<Feed />} />
                  <Route path="/search" element={<Search />} />
                  <Route path="/create" element={<Create />} />
                  <Route path="/chats" element={<Chats />} />
                  <Route path="/groups" element={<Groups />} />
                  <Route path="/stories" element={<Stories />} />
                  <Route path="/u/:userId" element={<Profile />} />
                  <Route path="/profile/:userId" element={<Profile />} />
                  <Route path="/@:userId" element={<Profile />} />
                  <Route path="/post/:postId" element={<PostDetail />} />
                  <Route path="/admin" element={<Admin />} />
                  <Route path="/notifications" element={<Notifications />} />
                  <Route path="/settings" element={<Settings />} />
                  <Route path="/tiger-ai" element={<TigerAI />} />
                  <Route path="/game" element={<Game />} />
                  <Route path="/draughts" element={<Draughts />} />
                </Route>

                <Route path="*" element={<NotFound />} />
              </Routes>
            </BrowserRouter></TwoFactorGate>
          </TooltipProvider>
        </AuthProvider>
      </LanguageProvider>
    </ThemeProvider>
  </QueryClientProvider>
  </HelmetProvider>
);

export default App;
