import { Switch, Route, Router as WouterRouter, useLocation } from "wouter";
import { useEffect, useState } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AdminLayout } from "@/components/layout";
import { useAuth } from "@/hooks/use-auth";
import { useIdleTimeout, performIdleLogout } from "@/hooks/use-idle-timeout";
import { IdleWarningModal } from "@/components/idle-warning-modal";
import { useGetSettings } from "@workspace/api-client-react";
import NotFound from "@/pages/not-found";
import { Loader2 } from "lucide-react";

import Dashboard from "@/pages/dashboard";
import Projects from "@/pages/projects";
import Tasks from "@/pages/tasks";
import Indicators from "@/pages/indicators";
import Targets from "@/pages/targets";
import Results from "@/pages/results";
import Users from "@/pages/users";
import UserRequests from "@/pages/user-requests";
import RoleChangeLogs from "@/pages/role-change-logs";
import AppSettings from "@/pages/settings";
import Login from "@/pages/login";
import Register from "@/pages/register";
import ChangePassword from "@/pages/change-password";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: false,
    },
  },
});

function AccessDenied() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4 text-center px-4">
      <div className="text-5xl">🔒</div>
      <h2 className="text-xl font-bold">접근 권한이 없습니다</h2>
      <p className="text-muted-foreground text-sm">
        이 페이지는 관리자만 접근할 수 있습니다.
      </p>
    </div>
  );
}

function AuthSpinner() {
  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
    </div>
  );
}

function MustChangePasswordGuard() {
  const [, navigate] = useLocation();
  const { mustChangePassword, isLoading, isLoggedIn } = useAuth();
  useEffect(() => {
    if (!isLoading && isLoggedIn && mustChangePassword) {
      navigate("/change-password");
    }
  }, [isLoading, isLoggedIn, mustChangePassword, navigate]);
  return null;
}

function IdleTimeoutGuard() {
  const { isLoggedIn, isLoading, refetch } = useAuth();
  const [, navigate] = useLocation();
  const [warningOpen, setWarningOpen] = useState(false);
  const { data: settingsData } = useGetSettings();
  const timeoutMinutes = settingsData?.sessionTimeoutMinutes ?? 30;
  const timeoutMs = timeoutMinutes * 60 * 1000;

  const { resetTimer } = useIdleTimeout({
    enabled: !isLoading && isLoggedIn,
    timeoutMs,
    onWarning: () => setWarningOpen(true),
    onWarningDismiss: () => setWarningOpen(false),
    onTimeout: async () => {
      setWarningOpen(false);
      await performIdleLogout(navigate, "timeout", timeoutMinutes);
      refetch();
    },
  });

  const handleContinue = () => {
    resetTimer();
    setWarningOpen(false);
  };

  const handleLogout = async () => {
    setWarningOpen(false);
    await performIdleLogout(navigate, "manual");
    refetch();
  };

  return (
    <IdleWarningModal
      open={warningOpen}
      onContinue={handleContinue}
      onLogout={handleLogout}
    />
  );
}

function RequireAuth({ children }: { children: React.ReactNode }) {
  const { isLoggedIn, isLoading, mustChangePassword } = useAuth();
  const [location, navigate] = useLocation();
  useEffect(() => {
    if (isLoading) return;
    if (!isLoggedIn) {
      navigate(`/login?redirect=${encodeURIComponent(location)}`);
      return;
    }
    if (mustChangePassword) {
      navigate("/change-password");
    }
  }, [isLoading, isLoggedIn, mustChangePassword, location, navigate]);
  if (isLoading) return <AuthSpinner />;
  if (!isLoggedIn) return null;
  if (mustChangePassword) return null;
  return <>{children}</>;
}

function RequireAdmin({ children }: { children: React.ReactNode }) {
  const { isLoggedIn, isAdmin, isLoading, mustChangePassword } = useAuth();
  const [location, navigate] = useLocation();
  useEffect(() => {
    if (isLoading) return;
    if (!isLoggedIn) {
      navigate(`/login?redirect=${encodeURIComponent(location)}`);
      return;
    }
    if (mustChangePassword) {
      navigate("/change-password");
    }
  }, [isLoading, isLoggedIn, mustChangePassword, location, navigate]);
  if (isLoading) return <AuthSpinner />;
  if (!isLoggedIn) return null;
  if (mustChangePassword) return null;
  if (!isAdmin) return <AccessDenied />;
  return <>{children}</>;
}

function AppRoutes() {
  return (
    <AdminLayout>
      <MustChangePasswordGuard />
      <Switch>
        <Route path="/">
          <RequireAuth><Dashboard /></RequireAuth>
        </Route>
        <Route path="/projects">
          <RequireAuth><Projects /></RequireAuth>
        </Route>
        <Route path="/tasks">
          <RequireAuth><Tasks /></RequireAuth>
        </Route>
        <Route path="/indicators">
          <RequireAuth><Indicators /></RequireAuth>
        </Route>
        <Route path="/targets">
          <RequireAuth><Targets /></RequireAuth>
        </Route>
        <Route path="/results">
          <RequireAuth><Results /></RequireAuth>
        </Route>
        <Route path="/users">
          <RequireAdmin><Users /></RequireAdmin>
        </Route>
        <Route path="/user-requests">
          <RequireAdmin><UserRequests /></RequireAdmin>
        </Route>
        <Route path="/role-change-logs">
          <RequireAdmin><RoleChangeLogs /></RequireAdmin>
        </Route>
        <Route path="/settings">
          <RequireAdmin><AppSettings /></RequireAdmin>
        </Route>
        <Route component={NotFound} />
      </Switch>
    </AdminLayout>
  );
}

function Router() {
  return (
    <>
      <IdleTimeoutGuard />
      <Switch>
        <Route path="/login" component={Login} />
        <Route path="/register" component={Register} />
        <Route path="/change-password" component={ChangePassword} />
        <Route component={AppRoutes} />
      </Switch>
    </>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
          <Router />
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
