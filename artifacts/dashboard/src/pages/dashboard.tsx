import { useEffect } from "react";
import { 
  useGetDashboardSummary, 
  useGetRecentActivity, 
  useGetZoneStatus,
  useGetAiDecisions
} from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Activity, AlertTriangle, CheckSquare, Shield, Tractor, Users } from "lucide-react";
import { socket } from "@/lib/socket";

export default function Dashboard() {
  const { data: summary, isLoading: loadingSummary, refetch: refetchSummary } = useGetDashboardSummary();
  const { data: activity, isLoading: loadingActivity, refetch: refetchActivity } = useGetRecentActivity();
  const { data: zones, isLoading: loadingZones, refetch: refetchZones } = useGetZoneStatus();
  const { data: aiDecisions, isLoading: loadingAi, refetch: refetchAi } = useGetAiDecisions({ limit: 5 });

  useEffect(() => {
    socket.connect();

    const onUpdate = () => {
      refetchSummary();
      refetchActivity();
      refetchZones();
      refetchAi();
    };

    socket.on("worker:update", onUpdate);
    socket.on("machine:update", onUpdate);
    socket.on("alert:new", onUpdate);
    socket.on("task:update", onUpdate);
    socket.on("hazard:new", onUpdate);
    socket.on("ai:decision", onUpdate);

    return () => {
      socket.off("worker:update", onUpdate);
      socket.off("machine:update", onUpdate);
      socket.off("alert:new", onUpdate);
      socket.off("task:update", onUpdate);
      socket.off("hazard:new", onUpdate);
      socket.off("ai:decision", onUpdate);
      socket.disconnect();
    };
  }, [refetchSummary, refetchActivity, refetchZones, refetchAi]);

  if (loadingSummary) return <div className="p-8">LOADING TELEMETRY...</div>;

  return (
    <div className="p-8 space-y-6">
      <div className="flex justify-between items-end">
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-foreground">SITE COMMAND</h2>
          <p className="text-muted-foreground uppercase tracking-widest text-xs mt-1">Live Telemetry & Analytics</p>
        </div>
        <div className="flex items-center gap-2 bg-card border border-border px-4 py-2 rounded">
          <Shield className={`h-5 w-5 ${summary?.siteHealthScore && summary.siteHealthScore > 80 ? 'text-primary' : 'text-amber-500'}`} />
          <span className="font-bold text-xl">{summary?.siteHealthScore}%</span>
          <span className="text-xs text-muted-foreground uppercase tracking-wider ml-2">Health Index</span>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="bg-card rounded-sm border-border">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-xs font-bold uppercase tracking-wider">Active Workers</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{summary?.activeWorkers} / {summary?.totalWorkers}</div>
          </CardContent>
        </Card>
        <Card className="bg-card rounded-sm border-border">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-xs font-bold uppercase tracking-wider">Active Machines</CardTitle>
            <Tractor className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{summary?.activeMachines} / {summary?.totalMachines}</div>
          </CardContent>
        </Card>
        <Card className="bg-card rounded-sm border-border">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-xs font-bold uppercase tracking-wider">Open Tasks</CardTitle>
            <CheckSquare className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{summary?.openTasks}</div>
            <p className="text-xs text-muted-foreground mt-1">Completed today: {summary?.tasksCompletedToday || 0}</p>
          </CardContent>
        </Card>
        <Card className="bg-card rounded-sm border-border">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-xs font-bold uppercase tracking-wider">Active Hazards</CardTitle>
            <AlertTriangle className="h-4 w-4 text-destructive" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-destructive">{summary?.activeHazards}</div>
            <p className="text-xs text-muted-foreground mt-1">Critical: {summary?.criticalHazards || 0}</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="col-span-2 bg-card rounded-sm border-border">
          <CardHeader>
            <CardTitle className="text-sm font-bold uppercase tracking-wider flex items-center gap-2">
              <Activity className="h-4 w-4" /> Zone Status Matrix
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              {zones?.map((zone) => (
                <div key={zone.zone} className="border border-border p-3 rounded bg-background flex flex-col">
                  <div className="flex justify-between items-center mb-2">
                    <span className="font-bold">{zone.zone}</span>
                    <span className={`h-2 w-2 rounded-full ${
                      zone.status === 'clear' ? 'bg-primary' : 
                      zone.status === 'caution' ? 'bg-amber-500' : 'bg-destructive'
                    }`} />
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="text-muted-foreground">Workers: <span className="text-foreground">{zone.workerCount}</span></div>
                    <div className="text-muted-foreground">Machines: <span className="text-foreground">{zone.machineCount}</span></div>
                    <div className="text-muted-foreground">Hazards: <span className="text-foreground">{zone.hazardCount}</span></div>
                    <div className="text-muted-foreground">Tasks: <span className="text-foreground">{zone.taskCount}</span></div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card rounded-sm border-border">
          <CardHeader>
            <CardTitle className="text-sm font-bold uppercase tracking-wider flex items-center gap-2">
              <AlertTriangle className="h-4 w-4" /> Recent Activity
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {activity?.slice(0, 8).map((item) => (
                <div key={item.id} className="flex gap-3 text-sm">
                  <div className={`mt-0.5 h-2 w-2 shrink-0 rounded-full ${
                    item.severity === 'critical' ? 'bg-destructive' :
                    item.severity === 'high' ? 'bg-amber-500' : 'bg-primary'
                  }`} />
                  <div>
                    <p className="text-foreground leading-tight">{item.message}</p>
                    <div className="flex gap-2 mt-1 text-xs text-muted-foreground">
                      <span className="uppercase">{item.type}</span>
                      {item.zone && <span>• {item.zone}</span>}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}