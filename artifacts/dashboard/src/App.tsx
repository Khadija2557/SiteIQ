import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";
import { Layout } from "@/components/layout";
import { setupAuth, ProtectedRoute } from "@/lib/auth";

// Pages
import Login from "@/pages/login";
import Dashboard from "@/pages/dashboard";
import Workers from "@/pages/workers";
import Tasks from "@/pages/tasks";
import Machines from "@/pages/machines";
import Hazards from "@/pages/hazards";
import Alerts from "@/pages/alerts";
import Deliveries from "@/pages/deliveries";
import AiOperations from "@/pages/ai";
import Cameras from "@/pages/cameras";
import Reports from "@/pages/reports";

setupAuth();

const queryClient = new QueryClient();

function Router() {
  return (
    <Switch>
      <Route path="/login" component={Login} />
      
      <Route path="/">
        <ProtectedRoute>
          <Layout><Dashboard /></Layout>
        </ProtectedRoute>
      </Route>
      <Route path="/workers">
        <ProtectedRoute>
          <Layout><Workers /></Layout>
        </ProtectedRoute>
      </Route>
      <Route path="/tasks">
        <ProtectedRoute>
          <Layout><Tasks /></Layout>
        </ProtectedRoute>
      </Route>
      <Route path="/machines">
        <ProtectedRoute>
          <Layout><Machines /></Layout>
        </ProtectedRoute>
      </Route>
      <Route path="/hazards">
        <ProtectedRoute>
          <Layout><Hazards /></Layout>
        </ProtectedRoute>
      </Route>
      <Route path="/alerts">
        <ProtectedRoute>
          <Layout><Alerts /></Layout>
        </ProtectedRoute>
      </Route>
      <Route path="/deliveries">
        <ProtectedRoute>
          <Layout><Deliveries /></Layout>
        </ProtectedRoute>
      </Route>
      <Route path="/ai">
        <ProtectedRoute>
          <Layout><AiOperations /></Layout>
        </ProtectedRoute>
      </Route>
      <Route path="/cameras">
        <ProtectedRoute>
          <Layout><Cameras /></Layout>
        </ProtectedRoute>
      </Route>
      <Route path="/reports">
        <ProtectedRoute>
          <Layout><Reports /></Layout>
        </ProtectedRoute>
      </Route>
      
      {/* Fallback to layout with not found, protected or not depending on context but safe to wrap */}
      <Route>
        <Layout><NotFound /></Layout>
      </Route>
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