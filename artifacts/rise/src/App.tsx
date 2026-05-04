import { Switch, Route, Router as WouterRouter } from "wouter";
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

const queryClient = new QueryClient();

function Router() {
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
        <Route component={NotFound} />
      </Switch>
    </AdminLayout>
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
