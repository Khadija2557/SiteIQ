import { Link, useLocation } from "wouter";
import { 
  LayoutDashboard, 
  Users, 
  CheckSquare, 
  Tractor, 
  AlertTriangle, 
  Bell, 
  Truck, 
  BrainCircuit, 
  Video, 
  FileText,
  LogOut
} from "lucide-react";
import axios from "axios";
import { useGetMe } from "@workspace/api-client-react";

export function Layout({ children }: { children: React.ReactNode }) {
  const [location, setLocation] = useLocation();
  const { data: user } = useGetMe({ query: { retry: false, refetchOnWindowFocus: false } });

  const handleLogout = () => {
    localStorage.removeItem("token");
    delete axios.defaults.headers.common["Authorization"];
    setLocation("/login");
  };

  const navItems = [
    { href: "/", label: "Command", icon: LayoutDashboard },
    { href: "/workers", label: "Workers", icon: Users },
    { href: "/tasks", label: "Tasks", icon: CheckSquare },
    { href: "/machines", label: "Machines", icon: Tractor },
    { href: "/hazards", label: "Hazards", icon: AlertTriangle },
    { href: "/alerts", label: "Alerts", icon: Bell },
    { href: "/deliveries", label: "Deliveries", icon: Truck },
    { href: "/ai", label: "AI Ops", icon: BrainCircuit },
    { href: "/cameras", label: "Cameras", icon: Video },
    { href: "/reports", label: "Reports", icon: FileText },
  ];

  return (
    <div className="flex h-[100dvh] w-full bg-background text-foreground overflow-hidden font-mono dark">
      <div className="w-64 border-r border-border bg-card flex flex-col">
        <div className="p-4 border-b border-border">
          <h1 className="text-xl font-bold tracking-tighter text-primary">SITE<span className="text-foreground">IQ</span></h1>
          <div className="text-xs text-muted-foreground mt-1 tracking-widest uppercase">Command Center</div>
        </div>
        <nav className="flex-1 overflow-y-auto py-4 px-2 space-y-1">
          {navItems.map((item) => {
            const active = location === item.href;
            return (
              <Link 
                key={item.href} 
                href={item.href}
                className={`flex items-center gap-3 px-3 py-2 rounded-md text-sm cursor-pointer transition-colors ${active ? "bg-primary text-primary-foreground font-semibold" : "hover:bg-accent text-muted-foreground hover:text-foreground"}`}
              >
                <item.icon className="h-4 w-4" />
                {item.label}
              </Link>
            )
          })}
        </nav>
        <div className="p-4 border-t border-border">
          <div className="text-xs text-muted-foreground mb-2 truncate">
            {user?.email || "System User"}
          </div>
          <button onClick={handleLogout} className="flex items-center gap-2 text-sm text-destructive hover:text-destructive/80 transition-colors w-full">
            <LogOut className="h-4 w-4" />
            Sign out
          </button>
        </div>
      </div>
      <main className="flex-1 overflow-auto bg-background">
        {children}
      </main>
    </div>
  );
}