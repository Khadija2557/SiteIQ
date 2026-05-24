import { useGetDashboardSummary, useGetRecentActivity, useGetZoneStatus } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Activity, Users, Truck, CheckSquare, AlertTriangle, BellRing, Shield } from "lucide-react";

export default function Dashboard() {
  const { data: summary, isLoading: isLoadingSummary } = useGetDashboardSummary();
  const { data: activity, isLoading: isLoadingActivity } = useGetRecentActivity();
  const { data: zones, isLoading: isLoadingZones } = useGetZoneStatus();

  if (isLoadingSummary || isLoadingActivity || isLoadingZones) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="h-8 w-64 bg-muted rounded"></div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-32 bg-card rounded-xl border border-border"></div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8 fade-in-up">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-mono font-bold tracking-tight text-foreground uppercase">Command Overview</h1>
          <p className="text-sm font-mono text-muted-foreground mt-1 uppercase tracking-widest">Real-time facility status</p>
        </div>
        
        {summary && (
          <div className="flex items-center gap-4 bg-card/50 p-4 rounded-xl border border-border backdrop-blur">
            <div className="flex flex-col items-end">
              <span className="text-[10px] font-mono text-muted-foreground uppercase tracking-widest">Site Health</span>
              <span className={`text-2xl font-mono font-bold ${summary.siteHealthScore > 80 ? 'text-safe' : summary.siteHealthScore > 50 ? 'text-warning' : 'text-critical'}`}>
                {summary.siteHealthScore}%
              </span>
            </div>
            <div className="w-12 h-12 rounded-full border-4 flex items-center justify-center relative" style={{
              borderColor: summary.siteHealthScore > 80 ? 'var(--color-safe)' : summary.siteHealthScore > 50 ? 'var(--color-warning)' : 'var(--color-critical)'
            }}>
              <Shield className={`w-6 h-6 ${summary.siteHealthScore > 80 ? 'text-safe' : summary.siteHealthScore > 50 ? 'text-warning' : 'text-critical'}`} />
            </div>
          </div>
        )}
      </div>

      {summary && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <MetricCard 
            title="Active Personnel" 
            value={`${summary.activeWorkers}/${summary.totalWorkers}`}
            icon={Users}
            trend="Stable"
            color="primary"
          />
          <MetricCard 
            title="Machine Fleet" 
            value={`${summary.activeMachines}/${summary.totalMachines}`}
            icon={Truck}
            trend="Optimum"
            color="info"
          />
          <MetricCard 
            title="Active Hazards" 
            value={summary.activeHazards}
            icon={AlertTriangle}
            trend={summary.criticalHazards ? `${summary.criticalHazards} Critical` : "Clear"}
            color={summary.activeHazards > 0 ? "warning" : "safe"}
            pulse={summary.criticalHazards ? summary.criticalHazards > 0 : false}
          />
          <MetricCard 
            title="Task Progress" 
            value={`${summary.completedTasks}/${summary.openTasks + summary.completedTasks}`}
            icon={CheckSquare}
            trend={`${summary.tasksCompletedToday || 0} Today`}
            color="safe"
          />
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="col-span-1 lg:col-span-2">
          <h2 className="text-xl font-mono font-bold text-foreground uppercase mb-4 flex items-center gap-2">
            <Activity className="w-5 h-5 text-primary" /> Sector Status Map
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {zones?.map((zone) => (
              <Card key={zone.zone} className="bg-card/40 backdrop-blur border-border hover:border-primary/50 transition-colors overflow-hidden relative group">
                <div className={`absolute top-0 left-0 w-full h-1 ${
                  zone.status === 'safe' ? 'bg-safe' : zone.status === 'warning' ? 'bg-warning' : 'bg-critical'
                }`} />
                <CardHeader className="pb-2">
                  <CardTitle className="text-lg font-mono flex justify-between items-center">
                    <span>Sector {zone.zone}</span>
                    <div className={`w-2 h-2 rounded-full ${
                      zone.status === 'safe' ? 'bg-safe shadow-[0_0_8px_var(--color-safe)]' : 
                      zone.status === 'warning' ? 'bg-warning shadow-[0_0_8px_var(--color-warning)]' : 
                      'bg-critical shadow-[0_0_8px_var(--color-critical)] animate-pulse'
                    }`} />
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-0 pb-4">
                  <div className="grid grid-cols-2 gap-2 text-sm font-mono">
                    <div className="flex flex-col">
                      <span className="text-muted-foreground text-[10px] uppercase">Personnel</span>
                      <span className="text-foreground">{zone.workerCount}</span>
                    </div>
                    <div className="flex flex-col">
                      <span className="text-muted-foreground text-[10px] uppercase">Machines</span>
                      <span className="text-foreground">{zone.machineCount}</span>
                    </div>
                    <div className="flex flex-col">
                      <span className="text-muted-foreground text-[10px] uppercase">Hazards</span>
                      <span className={`${zone.hazardCount > 0 ? 'text-warning' : 'text-foreground'}`}>{zone.hazardCount}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>

        <div>
          <h2 className="text-xl font-mono font-bold text-foreground uppercase mb-4 flex items-center gap-2">
            <BellRing className="w-5 h-5 text-primary" /> Live Feed
          </h2>
          <Card className="bg-card/40 backdrop-blur border-border h-[400px] flex flex-col">
            <CardContent className="p-0 flex-1 overflow-y-auto custom-scrollbar">
              <div className="divide-y divide-border">
                {activity?.map((item) => (
                  <div key={item.id} className="p-4 hover:bg-white/[0.02] transition-colors flex gap-4">
                    <div className="mt-1">
                      {item.severity === 'critical' ? (
                        <div className="w-2 h-2 rounded-full bg-critical shadow-[0_0_8px_var(--color-critical)] animate-pulse" />
                      ) : item.severity === 'warning' ? (
                        <div className="w-2 h-2 rounded-full bg-warning" />
                      ) : (
                        <div className="w-2 h-2 rounded-full bg-info" />
                      )}
                    </div>
                    <div>
                      <p className="text-sm text-foreground font-mono">{item.message}</p>
                      <div className="flex gap-2 mt-1">
                        <span className="text-[10px] text-muted-foreground font-mono uppercase bg-muted px-1.5 py-0.5 rounded">{item.type}</span>
                        {item.zone && <span className="text-[10px] text-muted-foreground font-mono uppercase bg-muted px-1.5 py-0.5 rounded">Zone {item.zone}</span>}
                        <span className="text-[10px] text-muted-foreground font-mono uppercase">{new Date(item.createdAt).toLocaleTimeString()}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

function MetricCard({ title, value, icon: Icon, trend, color, pulse = false }: any) {
  return (
    <Card className="bg-card/40 backdrop-blur border-border relative overflow-hidden group">
      <div className={`absolute top-0 right-0 w-24 h-24 bg-${color}/10 rounded-bl-full -mr-4 -mt-4 transition-transform group-hover:scale-110`} />
      <CardContent className="p-6">
        <div className="flex justify-between items-start">
          <div className="space-y-2">
            <p className="text-[11px] font-mono text-muted-foreground uppercase tracking-widest">{title}</p>
            <p className="text-3xl font-mono font-bold text-foreground">{value}</p>
          </div>
          <div className={`p-3 rounded-xl bg-${color}/10 border border-${color}/20 ${pulse ? 'animate-pulse' : ''}`}>
            <Icon className={`w-5 h-5 text-${color}`} style={{ color: `var(--color-${color}, var(--${color}))` }} />
          </div>
        </div>
        <div className="mt-4 flex items-center gap-2">
          <div className={`w-1.5 h-1.5 rounded-full bg-${color}`} style={{ backgroundColor: `var(--color-${color}, var(--${color}))` }} />
          <span className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider">{trend}</span>
        </div>
      </CardContent>
    </Card>
  );
}
