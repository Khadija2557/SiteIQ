import { ReactNode } from "react";
import { Link, useLocation } from "wouter";
import { useAuth } from "@/lib/auth";
import { 
  Activity, 
  Users, 
  CheckSquare, 
  Truck, 
  AlertTriangle, 
  BellRing, 
  Package, 
  Video, 
  Cpu, 
  BarChart2,
  FileText,
  LogOut,
  Menu
} from "lucide-react";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";

const NAV_ITEMS = [
  { href: "/dashboard", label: "Dashboard", icon: Activity },
  { href: "/workers", label: "Workers", icon: Users },
  { href: "/tasks", label: "Tasks", icon: CheckSquare },
  { href: "/machines", label: "Machines", icon: Truck },
  { href: "/hazards", label: "Hazards", icon: AlertTriangle },
  { href: "/alerts", label: "Alerts", icon: BellRing },
  { href: "/deliveries", label: "Deliveries", icon: Package },
  { href: "/cameras", label: "Cameras", icon: Video },
  { href: "/robots", label: "Robots", icon: Cpu },
  { href: "/analytics", label: "Analytics", icon: BarChart2 },
  { href: "/reports", label: "Reports", icon: FileText },
];

export function Layout({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  const { logout } = useAuth();

  const NavLinks = () => (
    <nav className="space-y-1 mt-6 px-3">
      {NAV_ITEMS.map((item) => {
        const Icon = item.icon;
        const isActive = location === item.href;
        return (
          <Link key={item.href} href={item.href}>
            <div
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200 cursor-pointer font-mono text-sm uppercase tracking-wide
                ${isActive 
                  ? "bg-primary/10 text-primary border border-primary/20 shadow-[inset_0_0_10px_rgba(var(--primary),0.1)]" 
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
                }
              `}
            >
              <Icon className={`w-5 h-5 ${isActive ? "text-primary" : "opacity-70"}`} />
              {item.label}
              {isActive && (
                <div className="ml-auto w-1.5 h-1.5 rounded-full bg-primary shadow-[0_0_8px_rgba(var(--primary),0.8)] animate-pulse" />
              )}
            </div>
          </Link>
        );
      })}
    </nav>
  );

  return (
    <div className="flex h-screen bg-background overflow-hidden text-foreground selection:bg-primary/30">
      {/* Desktop Sidebar */}
      <aside className="hidden md:flex flex-col w-64 bg-card border-r border-border shadow-xl z-20">
        <div className="p-6 border-b border-border flex items-center gap-3">
          <div className="w-10 h-10 bg-primary/10 border border-primary/30 rounded-lg flex items-center justify-center shadow-[0_0_15px_rgba(var(--primary),0.15)] relative overflow-hidden">
            <div className="absolute inset-0 bg-primary/20 animate-pulse" />
            <Activity className="w-5 h-5 text-primary relative z-10" />
          </div>
          <div>
            <h1 className="text-xl font-mono font-bold tracking-tight text-foreground uppercase leading-none">SITE<span className="text-primary">IQ</span></h1>
            <p className="text-[10px] font-mono text-muted-foreground uppercase tracking-widest mt-1">Ops Command</p>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto custom-scrollbar">
          <NavLinks />
        </div>

        <div className="p-4 border-t border-border mt-auto bg-card">
          <div className="mb-4 px-2">
            <p className="text-xs font-mono text-muted-foreground uppercase tracking-wider">Facility</p>
            <p className="text-sm font-mono text-foreground font-semibold">Tower Construction Ltd</p>
            <div className="flex items-center gap-2 mt-2">
              <div className="w-2 h-2 rounded-full bg-safe shadow-[0_0_8px_var(--color-safe)] animate-pulse" />
              <p className="text-[10px] font-mono text-safe uppercase tracking-widest">System Online</p>
            </div>
          </div>
          <Button 
            variant="ghost" 
            className="w-full justify-start text-muted-foreground hover:text-destructive hover:bg-destructive/10 font-mono uppercase text-xs tracking-wider border border-transparent hover:border-destructive/20"
            onClick={logout}
          >
            <LogOut className="w-4 h-4 mr-2" />
            Terminate Session
          </Button>
        </div>
      </aside>

      {/* Mobile Sidebar & Header */}
      <div className="md:hidden fixed top-0 left-0 right-0 h-16 bg-card border-b border-border z-30 flex items-center justify-between px-4">
        <div className="flex items-center gap-2">
          <Activity className="w-6 h-6 text-primary" />
          <h1 className="text-xl font-mono font-bold text-foreground uppercase">SITE<span className="text-primary">IQ</span></h1>
        </div>
        <Sheet>
          <SheetTrigger asChild>
            <Button variant="ghost" size="icon" className="text-foreground">
              <Menu className="w-6 h-6" />
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="w-72 bg-card border-r border-border p-0 flex flex-col">
             <div className="p-6 border-b border-border">
              <h1 className="text-xl font-mono font-bold text-foreground uppercase">SITE<span className="text-primary">IQ</span></h1>
            </div>
            <div className="flex-1 overflow-y-auto">
              <NavLinks />
            </div>
            <div className="p-4 border-t border-border">
              <Button 
                variant="ghost" 
                className="w-full justify-start text-muted-foreground hover:text-destructive hover:bg-destructive/10 font-mono uppercase text-xs"
                onClick={logout}
              >
                <LogOut className="w-4 h-4 mr-2" />
                Terminate Session
              </Button>
            </div>
          </SheetContent>
        </Sheet>
      </div>

      {/* Main Content */}
      <main className="flex-1 relative overflow-y-auto custom-scrollbar md:pt-0 pt-16">
        <div className="absolute top-0 left-0 w-full h-full pointer-events-none z-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-primary/5 via-background to-background" />
        <div className="relative z-10 p-6 md:p-8 min-h-full">
          {children}
        </div>
      </main>
    </div>
  );
}
