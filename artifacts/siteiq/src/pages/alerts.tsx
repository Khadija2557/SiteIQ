import { useListAlerts, useAcknowledgeAlert, getListAlertsQueryKey } from "@workspace/api-client-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { BellRing, ShieldAlert, Check } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";

export default function Alerts() {
  const { data: alerts, isLoading } = useListAlerts();
  const acknowledgeAlert = useAcknowledgeAlert();
  const queryClient = useQueryClient();

  const handleAcknowledge = (id: number) => {
    acknowledgeAlert.mutate(
      { id },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListAlertsQueryKey() });
        }
      }
    );
  };

  return (
    <div className="space-y-6 fade-in-up max-w-5xl mx-auto">
      <div>
        <h1 className="text-3xl font-mono font-bold tracking-tight text-foreground uppercase flex items-center gap-3">
          <BellRing className="w-8 h-8 text-primary" />
          Alert Center
        </h1>
        <p className="text-sm font-mono text-muted-foreground mt-1 uppercase tracking-widest">Real-time System Notifications</p>
      </div>

      <div className="bg-card/40 backdrop-blur rounded-xl border border-border overflow-hidden">
        <div className="p-4 border-b border-border bg-muted/20 flex justify-between items-center">
           <h2 className="font-mono text-sm uppercase tracking-widest">Unresolved Alerts</h2>
           <Badge variant="outline" className="font-mono bg-destructive/10 text-destructive border-destructive/20">
             {alerts?.filter(a => !a.acknowledged).length || 0} Critical
           </Badge>
        </div>
        
        <div className="divide-y divide-border">
          {isLoading ? (
            <div className="p-8 text-center font-mono text-muted-foreground animate-pulse">Scanning frequencies...</div>
          ) : alerts?.filter(a => !a.acknowledged).map((alert) => (
            <div key={alert.id} className="p-4 hover:bg-white/[0.02] transition-colors flex flex-col md:flex-row gap-4 items-start md:items-center justify-between group">
              <div className="flex gap-4 items-start">
                <div className={`mt-1 w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${
                  alert.severity === 'critical' ? 'bg-critical/20 text-critical border border-critical/30' :
                  alert.severity === 'high' ? 'bg-warning/20 text-warning border border-warning/30' :
                  'bg-info/20 text-info border border-info/30'
                }`}>
                  <ShieldAlert className="w-4 h-4" />
                </div>
                <div>
                  <div className="flex flex-wrap items-center gap-2 mb-1">
                    <span className="font-mono text-sm text-foreground">{alert.message}</span>
                    <Badge variant="outline" className={`font-mono text-[9px] uppercase px-1.5 py-0 ${
                      alert.severity === 'critical' ? 'border-critical text-critical' :
                      alert.severity === 'high' ? 'border-warning text-warning' :
                      'border-info text-info'
                    }`}>
                      {alert.severity}
                    </Badge>
                    <Badge variant="outline" className="font-mono text-[9px] uppercase px-1.5 py-0 border-muted text-muted-foreground">
                      {alert.type}
                    </Badge>
                    {alert.zone && (
                       <Badge variant="outline" className="font-mono text-[9px] uppercase px-1.5 py-0 border-primary/30 text-primary bg-primary/5">
                         Zone {alert.zone}
                       </Badge>
                    )}
                  </div>
                  <div className="text-[10px] font-mono text-muted-foreground uppercase flex gap-4">
                    <span>{new Date(alert.createdAt).toLocaleString()}</span>
                    {alert.workerId && <span>Worker: {alert.workerId}</span>}
                    {alert.machineId && <span>Machine: {alert.machineId}</span>}
                  </div>
                </div>
              </div>
              <Button 
                variant="outline" 
                size="sm"
                className="font-mono text-[10px] h-8 md:opacity-0 group-hover:opacity-100 transition-opacity hover:bg-safe/10 hover:text-safe hover:border-safe/30"
                onClick={() => handleAcknowledge(alert.id)}
                disabled={acknowledgeAlert.isPending}
              >
                <Check className="w-3 h-3 mr-1" /> Acknowledge
              </Button>
            </div>
          ))}
          
          {alerts?.filter(a => !a.acknowledged).length === 0 && (
             <div className="p-8 text-center font-mono text-muted-foreground uppercase tracking-widest">
               All clear. No active alerts.
             </div>
          )}
        </div>
      </div>
    </div>
  );
}
