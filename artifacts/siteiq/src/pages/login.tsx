import { useAuth } from "@/lib/auth";
import { useState } from "react";
import { useLogin } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AlertTriangle, Activity } from "lucide-react";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const { login } = useAuth();
  const [error, setError] = useState("");

  const loginMutation = useLogin();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    loginMutation.mutate(
      { data: { email, password } },
      {
        onSuccess: (data) => {
          login(data.token, data.user);
        },
        onError: (err: any) => {
          setError(err.message || "Invalid credentials. Please try again.");
        },
      }
    );
  };

  const handleDemoLogin = () => {
    setError("");
    loginMutation.mutate(
      { data: { email: "admin@siteiq.com", password: "demo123" } },
      {
        onSuccess: (data) => {
          login(data.token, data.user);
        },
        onError: () => {
          setError("Demo login failed — please use admin@tower.com / admin123");
        },
      }
    );
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-background relative overflow-hidden">
      {/* Background ambient effects */}
      <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-primary/10 via-background to-background" />
      <div className="absolute top-1/4 -left-1/4 w-96 h-96 bg-primary/5 rounded-full blur-[128px]" />
      <div className="absolute bottom-1/4 -right-1/4 w-96 h-96 bg-info/5 rounded-full blur-[128px]" />

      <div className="relative z-10 w-full max-w-md p-8 bg-card/50 backdrop-blur-xl border border-border rounded-xl shadow-2xl">
        <div className="flex flex-col items-center mb-8">
          <div className="w-16 h-16 bg-primary/10 border border-primary/20 rounded-2xl flex items-center justify-center mb-4 shadow-[0_0_30px_rgba(var(--primary),0.2)]">
            <Activity className="w-8 h-8 text-primary animate-pulse" />
          </div>
          <h1 className="text-3xl font-mono font-bold tracking-tight text-foreground uppercase">SITE<span className="text-primary">IQ</span></h1>
          <p className="text-sm font-mono text-muted-foreground mt-2 uppercase tracking-widest">Ops Command Center</p>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-destructive/10 border border-destructive/20 rounded-lg flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-destructive shrink-0 mt-0.5" />
            <p className="text-sm text-destructive-foreground">{error}</p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="email" className="font-mono text-xs uppercase text-muted-foreground">Officer ID / Email</Label>
            <Input
              id="email"
              type="email"
              placeholder="operator@siteiq.local"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="bg-background/50 border-input font-mono placeholder:text-muted-foreground/50 h-12"
              required
            />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="password" className="font-mono text-xs uppercase text-muted-foreground">Access Code</Label>
            <Input
              id="password"
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="bg-background/50 border-input font-mono placeholder:text-muted-foreground/50 h-12"
              required
            />
          </div>

          <Button
            type="submit"
            className="w-full h-12 font-mono uppercase tracking-wider text-sm hover:shadow-[0_0_20px_rgba(var(--primary),0.4)] transition-all duration-300"
            disabled={loginMutation.isPending}
          >
            {loginMutation.isPending ? "Authenticating..." : "Initialize Session"}
          </Button>
        </form>

        <div className="mt-6">
          <div className="relative flex items-center gap-3 mb-4">
            <div className="flex-1 h-px bg-border" />
            <span className="text-[10px] font-mono text-muted-foreground uppercase tracking-widest">or</span>
            <div className="flex-1 h-px bg-border" />
          </div>
          <Button
            type="button"
            variant="outline"
            className="w-full h-10 font-mono text-xs uppercase tracking-wider border-border text-muted-foreground hover:text-foreground hover:border-primary/40 transition-all"
            onClick={handleDemoLogin}
            disabled={loginMutation.isPending}
            data-testid="button-demo-login"
          >
            Demo Login — admin@siteiq.com
          </Button>
        </div>

        <div className="mt-6 text-center border-t border-border pt-4">
          <p className="text-[10px] font-mono text-muted-foreground uppercase tracking-widest">
            Restricted Access <br/> Authorized Personnel Only
          </p>
        </div>
      </div>
    </div>
  );
}
