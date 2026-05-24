import { useEffect } from "react";
import { Switch, Route, Router as WouterRouter, Redirect, useLocation } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "@/lib/auth";
import { Layout } from "@/components/layout";

import Login from "@/pages/login";
import Dashboard from "@/pages/dashboard";
import Workers from "@/pages/workers";
import Tasks from "@/pages/tasks";
import Machines from "@/pages/machines";
import Hazards from "@/pages/hazards";
import Alerts from "@/pages/alerts";
import Deliveries from "@/pages/deliveries";
import Cameras from "@/pages/cameras";
import Robots from "@/pages/robots";
import Analytics from "@/pages/analytics";
import Reports from "@/pages/reports";
import NotFound from "@/pages/not-found";
import WorkerApp from "@/pages/worker";

const queryClient = new QueryClient();

function ProtectedRoute({ component: Component }: { component: any }) {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="w-16 h-16 border-4 border-primary/20 border-t-primary rounded-full animate-spin"></div>
      </div>
    );
  }

  if (!user) {
    return <Redirect to="/login" />;
  }

  return (
    <Layout>
      <Component />
    </Layout>
  );
}

function MobileRedirect() {
  const [location, navigate] = useLocation();
  useEffect(() => {
    const isMobile = window.innerWidth < 768;
    const isWorkerPath = location.startsWith("/worker");
    if (isMobile && !isWorkerPath && location !== "/login") {
      navigate("/worker");
    }
  }, []);
  return null;
}

function Router() {
  return (
    <>
      <MobileRedirect />
      <Switch>
        <Route path="/">
          <Redirect to="/dashboard" />
        </Route>
        <Route path="/login" component={Login} />

        {/* Worker PWA — standalone mobile app, no layout wrapper */}
        <Route path="/worker/:rest*" component={WorkerApp} />
        <Route path="/worker" component={WorkerApp} />

        <Route path="/dashboard"><ProtectedRoute component={Dashboard} /></Route>
        <Route path="/workers"><ProtectedRoute component={Workers} /></Route>
        <Route path="/tasks"><ProtectedRoute component={Tasks} /></Route>
        <Route path="/machines"><ProtectedRoute component={Machines} /></Route>
        <Route path="/hazards"><ProtectedRoute component={Hazards} /></Route>
        <Route path="/alerts"><ProtectedRoute component={Alerts} /></Route>
        <Route path="/deliveries"><ProtectedRoute component={Deliveries} /></Route>
        <Route path="/cameras"><ProtectedRoute component={Cameras} /></Route>
        <Route path="/robots"><ProtectedRoute component={Robots} /></Route>
        <Route path="/analytics"><ProtectedRoute component={Analytics} /></Route>
        <Route path="/reports"><ProtectedRoute component={Reports} /></Route>

        <Route component={NotFound} />
      </Switch>
    </>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
          <AuthProvider>
            <Router />
          </AuthProvider>
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
