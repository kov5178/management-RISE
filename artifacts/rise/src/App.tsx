import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AdminLayout } from "@/components/layout";
import { useAuth } from "@/hooks/use-auth";
import NotFound from "@/pages/not-found";
import { LogIn } from "lucide-react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";

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

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: false,
    },
  },
});

function LoginRequired() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4 text-center px-4">
      <LogIn className="w-12 h-12 text-muted-foreground" />
      <h2 className="text-xl font-bold">로그인이 필요합니다</h2>
      <p className="text-muted-foreground text-sm">
        RISE 성과관리 시스템을 이용하려면 로그인해 주세요.
      </p>
      <Link href="/login">
        <Button>로그인</Button>
      </Link>
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

function RequireAuth({ children }: { children: React.ReactNode }) {
  const { isLoggedIn, isLoading } = useAuth();
  if (isLoading) return null;
  if (!isLoggedIn) return <LoginRequired />;
  return <>{children}</>;
}

function RequireAdmin({ children }: { children: React.ReactNode }) {
  const { isLoggedIn, isAdmin, isLoading } = useAuth();
  if (isLoading) return null;
  if (!isLoggedIn) return <LoginRequired />;
  if (!isAdmin) return <AccessDenied />;
  return <>{children}</>;
}

function AppRoutes() {
  return (
    <AdminLayout>
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
