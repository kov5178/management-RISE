import { Switch, Route, Router as WouterRouter, Redirect, useLocation } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AdminLayout } from "@/components/layout";
import { useAuth } from "@/hooks/use-auth";
import NotFound from "@/pages/not-found";
import { Skeleton } from "@/components/ui/skeleton";

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

function PrivateRoutes() {
  const [location] = useLocation();
  const { isLoggedIn, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="space-y-3 w-64">
          <Skeleton className="h-6 w-full" />
          <Skeleton className="h-6 w-3/4" />
          <Skeleton className="h-6 w-1/2" />
        </div>
      </div>
    );
  }

  if (!isLoggedIn) {
    const redirect = location !== "/" ? `?redirect=${encodeURIComponent(location)}` : "";
    return <Redirect to={`/login${redirect}`} />;
  }

  return (
    <AdminLayout>
      <Switch>
        <Route path="/" component={Dashboard} />
        <Route path="/projects" component={Projects} />
        <Route path="/tasks" component={Tasks} />
        <Route path="/indicators" component={Indicators} />
        <Route path="/targets" component={Targets} />
        <Route path="/results" component={Results} />
        <Route path="/evidence" component={Evidence} />
        <Route path="/reviews" component={Reviews} />
        <Route path="/feedback" component={Feedback} />
        <Route path="/users" component={Users} />
        <Route path="/user-requests" component={UserRequests} />
        <Route path="/role-change-logs" component={RoleChangeLogs} />
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
      <Route component={PrivateRoutes} />
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
