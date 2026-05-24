import { Card, CardContent } from "@/components/ui/card";
import { AlertTriangle, Home } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";

export default function NotFound() {
  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-background relative overflow-hidden">
      {/* Background ambient effects */}
      <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-destructive/10 via-background to-background" />
      <div className="absolute top-1/4 -left-1/4 w-96 h-96 bg-destructive/5 rounded-full blur-[128px]" />

      <div className="relative z-10 w-full max-w-md p-8">
        <Card className="bg-card/50 backdrop-blur-xl border-destructive/20 shadow-2xl">
          <CardContent className="pt-8 flex flex-col items-center text-center">
            <div className="w-20 h-20 bg-destructive/10 border border-destructive/20 rounded-2xl flex items-center justify-center mb-6 shadow-[0_0_30px_rgba(var(--destructive),0.2)]">
              <AlertTriangle className="w-10 h-10 text-destructive animate-pulse" />
            </div>
            
            <h1 className="text-4xl font-mono font-bold tracking-tight text-foreground uppercase mb-2">Error 404</h1>
            <p className="text-sm font-mono text-muted-foreground uppercase tracking-widest mb-8">
              Sector Not Found / Signal Lost
            </p>
            
            <div className="w-full bg-background/50 border border-border p-4 rounded font-mono text-xs text-left mb-8 text-muted-foreground">
              <p>{">"} INITIALIZING DIAGNOSTICS...</p>
              <p>{">"} LOCATING SECTOR COORDINATES...</p>
              <p className="text-destructive mt-2">{">"} ERROR: INVALID DESTINATION PARAMETERS</p>
              <p className="text-destructive">{">"} CONNECTION TERMINATED</p>
            </div>

            <Link href="/dashboard" className="w-full block">
              <Button className="w-full h-12 font-mono uppercase tracking-wider text-sm hover:shadow-[0_0_20px_rgba(var(--primary),0.4)] transition-all duration-300">
                <Home className="w-4 h-4 mr-2" />
                Return to Command Center
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
