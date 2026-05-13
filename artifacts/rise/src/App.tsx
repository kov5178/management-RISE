import { Switch, Route, Router as WouterRouter, Redirect, useLocation } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AdminLayout } from "@/components/layout";
import { useAuth } from "@/hooks/use-auth";
import NotFound from "@/pages/not-found";
import { Loader2 } from "lucide-react";

import Dashboard from "@/pages/dashboard";
import Projects from "@/pages/projects";
import Tasks from "@/pages/tasks";
import Indicators from "@/pages/indicators";
import Targets from "@/pages/targets";
import Results from "@/pages/results";
import Evidence from "@/pages/evidence";
import Reviews from "@/pages/reviews";
import Feedback from "@/pages/feedback";
import Users from "@/pages/users";
import UserRequests from "@/pages/user-requests";
import RoleChangeLogs from "@/pages/role-change-logs";
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

function AuthLoading() {
  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
    </div>
  );
}

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

function MustChangePasswordGuard() {
  const [, navigate] = useLocation();
  const { mustChangePassword, isLoading } = useAuth();
  if (isLoading) return null;
  if (mustChangePassword) {
    navigate("/change-password");
    return null;
  }
  return null;
}

function RequireAuth({ children }: { children: React.ReactNode }) {
  const { isLoggedIn, isLoading, mustChangePassword } = useAuth();
  const [location, navigate] = useLocation();
  if (isLoading) return <AuthLoading />;
  if (!isLoggedIn) return <Redirect to={`/login?redirect=${encodeURIComponent(location)}`} />;
  if (mustChangePassword) {
    navigate("/change-password");
    return null;
  }
  return <>{children}</>;
}

function RequireAdmin({ children }: { children: React.ReactNode }) {
  const { isLoggedIn, isAdmin, isLoading, mustChangePassword } = useAuth();
  const [location, navigate] = useLocation();
  if (isLoading) return <AuthLoading />;
  if (!isLoggedIn) return <Redirect to={`/login?redirect=${encodeURIComponent(location)}`} />;
  if (mustChangePassword) {
    navigate("/change-password");
    return null;
  }
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
        <Route path="/evidence">
          <RequireAuth><Evidence /></RequireAuth>
        </Route>
        <Route path="/reviews">
          <RequireAuth><Reviews /></RequireAuth>
        </Route>
        <Route path="/feedback">
          <RequireAuth><Feedback /></RequireAuth>
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
        <Route component={NotFound} />
      </Switch>
    </AdminLayout>
  );
}

function Router() {
  return (
    <Switch>
      <Route path="/login" component={Login} />
      <Route path="/register" component={Register} />
      <Route path="/change-password" component={ChangePassword} />
      <Route component={AppRoutes} />
    </Switch>
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
