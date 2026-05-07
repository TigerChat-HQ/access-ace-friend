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
  <QueryClientProvider client={queryClient}>
    <ThemeProvider>
      <LanguageProvider>
        <AuthProvider>
          <TooltipProvider>
            <Toaster />
            <Sonner />
            <BrowserRouter>
              <Routes>
                <Route path="/auth" element={<AuthRoute><Auth /></AuthRoute>} />
                <Route path="/forgot-password" element={<ForgotPassword />} />
                <Route path="/reset-password" element={<ResetPassword />} />
                <Route path="/install" element={<Install />} />

                <Route element={<ProtectedRoute><AppShell /></ProtectedRoute>}>
                  <Route path="/" element={<Feed />} />
                  <Route path="/search" element={<Search />} />
                  <Route path="/create" element={<Create />} />
                  <Route path="/chats" element={<Chats />} />
                  <Route path="/groups" element={<Groups />} />
                  <Route path="/stories" element={<Stories />} />
                  <Route path="/u/:userId" element={<Profile />} />
                  <Route path="/post/:postId" element={<PostDetail />} />
                  <Route path="/admin" element={<Admin />} />
                  <Route path="/notifications" element={<Notifications />} />
                  <Route path="/settings" element={<Settings />} />
                </Route>

                <Route path="*" element={<NotFound />} />
              </Routes>
            </BrowserRouter>
          </TooltipProvider>
        </AuthProvider>
      </LanguageProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;
