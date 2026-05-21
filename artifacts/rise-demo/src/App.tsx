import { Switch, Route, Router as WouterRouter } from "wouter";
import { useEffect, useRef, useState } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AdminLayout } from "@/components/layout";
import NotFound from "@/pages/not-found";

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
import AppSettings from "@/pages/settings";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: false,
    },
  },
});

function DemoBanner() {
  return (
    <div className="fixed top-0 left-0 right-0 z-50 bg-amber-500 text-white text-center text-sm font-semibold py-1.5 px-4 shadow-md">
      검토용 데모 버전 — 로그인 불필요 · 실제 운영 시스템이 아닙니다
    </div>
  );
}

function DemoAuthBootstrap({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);
  const attempted = useRef(false);

  useEffect(() => {
    if (attempted.current) return;
    attempted.current = true;

    fetch("/api/auth/demo-login", { method: "POST", credentials: "include" })
      .then(() => setReady(true))
      .catch(() => setReady(true));
  }, []);

  if (!ready) return null;
  return <>{children}</>;
}

function RequireAuth({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}

function RequireAdmin({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}

function AppRoutes() {
  return (
    <AdminLayout>
      <Switch>
        <Route path="/">
          <Dashboard />
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
        <Route path="/settings">
          <RequireAdmin><AppSettings /></RequireAdmin>
        </Route>
        <Route component={NotFound} />
      </Switch>
    </AdminLayout>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <DemoBanner />
        <div className="pt-8">
          <DemoAuthBootstrap>
            <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
              <AppRoutes />
            </WouterRouter>
          </DemoAuthBootstrap>
        </div>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
