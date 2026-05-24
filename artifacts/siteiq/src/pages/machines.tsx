import { useListMachines } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Truck, Activity, Wrench, User } from "lucide-react";
import { Progress } from "@/components/ui/progress";

export default function Machines() {
  const { data: machines, isLoading } = useListMachines();

  return (
    <div className="space-y-6 fade-in-up">
      <div>
        <h1 className="text-3xl font-mono font-bold tracking-tight text-foreground uppercase flex items-center gap-3">
          <Truck className="w-8 h-8 text-primary" />
          Machine Fleet
        </h1>
        <p className="text-sm font-mono text-muted-foreground mt-1 uppercase tracking-widest">Heavy Equipment Status & Utilization</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {isLoading ? (
          [...Array(8)].map((_, i) => (
            <div key={i} className="h-64 bg-card/40 rounded-xl border border-border animate-pulse" />
          ))
        ) : machines?.map((machine) => (
          <Card key={machine.id} className="bg-card/40 backdrop-blur border-border hover:border-primary/40 transition-all relative overflow-hidden group">
            <div className={`absolute top-0 left-0 w-full h-1 ${
              machine.status === 'active' ? 'bg-safe' : machine.status === 'maintenance' ? 'bg-warning' : 'bg-muted'
            }`} />
            <CardHeader className="pb-2">
              <div className="flex justify-between items-start mb-2">
                <Badge variant="outline" className={`font-mono text-[10px] ${
                  machine.status === 'active' ? 'border-safe text-safe bg-safe/10' :
                  machine.status === 'maintenance' ? 'border-warning text-warning bg-warning/10' :
                  'border-muted text-muted-foreground bg-muted/20'
                }`}>
                  {machine.status}
                </Badge>
                <span className="font-mono text-xs text-muted-foreground uppercase">Zone {machine.zone}</span>
              </div>
              <CardTitle className="font-mono text-lg">{machine.name}</CardTitle>
              <p className="text-xs font-mono text-muted-foreground uppercase tracking-widest">{machine.type}</p>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-1">
                <div className="flex justify-between text-xs font-mono">
                  <span className="text-muted-foreground flex items-center gap-1 uppercase"><Activity className="w-3 h-3"/> Utilization</span>
                  <span className="text-foreground">{machine.utilizationPct || 0}%</span>
                </div>
                <Progress value={machine.utilizationPct || 0} className="h-1 bg-muted" indicatorClassName={
                  (machine.utilizationPct || 0) > 80 ? "bg-warning" : "bg-primary"
                } />
              </div>

              <div className="grid grid-cols-2 gap-2 text-xs font-mono">
                <div className="bg-background/50 p-2 rounded border border-border flex flex-col gap-1">
                  <span className="text-muted-foreground uppercase text-[9px] flex items-center gap-1"><User className="w-3 h-3"/> Operator</span>
                  <span className="text-foreground">{machine.operatorId ? `OP-${machine.operatorId.toString().padStart(4, '0')}` : 'Unassigned'}</span>
                </div>
                <div className="bg-background/50 p-2 rounded border border-border flex flex-col gap-1">
                  <span className="text-muted-foreground uppercase text-[9px] flex items-center gap-1"><Wrench className="w-3 h-3"/> Maintenance</span>
                  <span className={`text-foreground ${new Date(machine.maintenanceDue || '').getTime() < Date.now() ? 'text-critical' : ''}`}>
                    {machine.maintenanceDue ? new Date(machine.maintenanceDue).toLocaleDateString() : 'N/A'}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
