import { useState, useEffect } from "react";
import { socket } from "@/lib/socket";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Activity, Users, Truck, CheckSquare, AlertTriangle, BellRing, HeartPulse, Clock } from "lucide-react";
import { useGetDashboardSummary, useGetRecentActivity, useGetZoneStatus, useListAlerts, useAcknowledgeAlert, getListAlertsQueryKey, getGetDashboardSummaryQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

import iconUrl from "leaflet/dist/images/marker-icon.png";
import shadowUrl from "leaflet/dist/images/marker-shadow.png";
L.Icon.Default.mergeOptions({ iconUrl, shadowUrl });

export default function Dashboard() {
  const queryClient = useQueryClient();
  const [time, setTime] = useState(new Date());
  const [aiEvents, setAiEvents] = useState<{type: string, message: string, timestamp: string}[]>([]);
  
  const { data: summary } = useGetDashboardSummary({ query: { refetchInterval: 5000 } });
  const { data: recentActivity } = useGetRecentActivity({ query: { refetchInterval: 5000 } });
  const { data: zoneStatus } = useGetZoneStatus({ query: { refetchInterval: 5000 } });
  const { data: alerts } = useListAlerts({ acknowledged: false }, { query: { refetchInterval: 5000 } });
  
  const acknowledgeAlert = useAcknowledgeAlert();

  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    socket.connect();
    
    socket.on("ai_event", (event) => {
      setAiEvents(prev => [event, ...prev].slice(0, 5));
    });

    return () => {
      socket.off("ai_event");
      socket.disconnect();
    };
  }, []);

  useEffect(() => {
    const map = L.map("site-map", {
      zoomControl: false,
      attributionControl: false
    }).setView([51.505, -0.09], 18);
    
    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png').addTo(map);

    const markers: Record<string, L.CircleMarker> = {};

    const handlePositions = (data: any) => {
      // Update workers
      data.workers?.forEach((w: any) => {
        const lat = 51.505 + (w.y - 50) * 0.0001;
        const lng = -0.09 + (w.x - 50) * 0.0001;
        if (!markers[`w-${w.id}`]) {
          markers[`w-${w.id}`] = L.circleMarker([lat, lng], {
            color: '#06b6d4', fillColor: '#06b6d4', fillOpacity: 0.8, radius: 6
          }).addTo(map).bindTooltip(w.name);
        } else {
          markers[`w-${w.id}`].setLatLng([lat, lng]);
        }
      });
      // Update machines
      data.machines?.forEach((m: any) => {
        const lat = 51.505 + (m.y - 50) * 0.0001;
        const lng = -0.09 + (m.x - 50) * 0.0001;
        if (!markers[`m-${m.id}`]) {
          markers[`m-${m.id}`] = L.circleMarker([lat, lng], {
            color: '#f59e0b', fillColor: '#f59e0b', fillOpacity: 0.8, radius: 8
          }).addTo(map).bindTooltip(m.name);
        } else {
          markers[`m-${m.id}`].setLatLng([lat, lng]);
        }
      });
    };

    socket.on("positions", handlePositions);

    return () => {
      socket.off("positions", handlePositions);
      map.remove();
    };
  }, []);

  const handleAcknowledge = (id: number) => {
    acknowledgeAlert.mutate({ id }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListAlertsQueryKey() });
        queryClient.invalidateQueries({ queryKey: getGetDashboardSummaryQueryKey() });
      }
    });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between bg-card p-4 rounded-lg border border-border shadow-sm">
        <div>
          <h2 className="text-2xl font-bold font-mono tracking-tight uppercase text-foreground">Command Center</h2>
          <p className="text-sm text-muted-foreground font-mono tracking-wider uppercase">Live Operations Overview</p>
        </div>
        <div className="flex items-center gap-6 mt-4 md:mt-0">
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-primary" />
            <span className="font-mono text-xl tracking-widest">{format(time, "HH:mm:ss")}</span>
          </div>
          <div className="flex items-center gap-2 bg-safe/10 px-3 py-1.5 rounded-full border border-safe/20">
            <div className="w-2 h-2 rounded-full bg-safe animate-pulse" />
            <span className="text-xs font-mono text-safe uppercase tracking-widest font-bold">System Live</span>
          </div>
        </div>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <StatCard title="Active Workers" value={summary?.activeWorkers || 0} icon={Users} color="text-worker" />
        <StatCard title="Active Machines" value={summary?.activeMachines || 0} icon={Truck} color="text-machine" />
        <StatCard title="Open Tasks" value={summary?.openTasks || 0} icon={CheckSquare} color="text-primary" />
        <StatCard title="Active Hazards" value={summary?.activeHazards || 0} icon={AlertTriangle} color="text-hazard" />
        <StatCard title="Unresolved Alerts" value={summary?.unresolvedAlerts || 0} icon={BellRing} color="text-hazard" />
        <StatCard title="Health Score" value={`${summary?.siteHealthScore || 0}%`} icon={HeartPulse} color="text-safe" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Map */}
        <Card className="lg:col-span-2 bg-card border-border shadow-md">
          <CardHeader className="border-b border-border/50 pb-4">
            <CardTitle className="font-mono text-sm uppercase tracking-wider flex items-center gap-2">
              <Activity className="w-4 h-4 text-primary" />
              Live Site Map
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div id="site-map" className="h-[400px] w-full rounded-b-lg z-0 relative">
              <div className="absolute top-4 left-4 z-[400] bg-background/80 backdrop-blur-sm border border-border p-2 rounded flex flex-col gap-2">
                <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-worker" /><span className="text-xs font-mono uppercase">Worker</span></div>
                <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-machine" /><span className="text-xs font-mono uppercase">Machine</span></div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Alerts & AI Events */}
        <div className="space-y-6">
          <Card className="bg-card border-border shadow-md h-[190px] overflow-hidden flex flex-col">
            <CardHeader className="border-b border-border/50 pb-3 py-3">
              <CardTitle className="font-mono text-sm uppercase tracking-wider flex items-center gap-2 text-ai">
                <Activity className="w-4 h-4" />
                AI Decisions Feed
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0 overflow-y-auto flex-1 custom-scrollbar">
              <div className="divide-y divide-border/50">
                {aiEvents.length > 0 ? aiEvents.map((ev, i) => (
                  <div key={i} className="p-3 hover:bg-ai/5 transition-colors flex items-start gap-3">
                    <span className="text-[10px] font-mono text-ai border border-ai/20 px-1.5 py-0.5 rounded bg-ai/10 shrink-0 mt-0.5 uppercase">{ev.type}</span>
                    <p className="text-xs text-foreground leading-relaxed">{ev.message}</p>
                  </div>
                )) : (
                  <div className="p-4 text-center text-xs text-muted-foreground font-mono uppercase">Awaiting Intel...</div>
                )}
              </div>
            </CardContent>
          </Card>

          <Card className="bg-card border-border shadow-md flex-1">
            <CardHeader className="border-b border-border/50 pb-3 py-3">
              <CardTitle className="font-mono text-sm uppercase tracking-wider flex items-center gap-2 text-hazard">
                <AlertTriangle className="w-4 h-4" />
                Priority Alerts
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="divide-y divide-border/50">
                {alerts?.slice(0, 5).map(alert => (
                  <div key={alert.id} className="p-3 flex items-center justify-between hover:bg-muted/50 transition-colors">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className={`w-2 h-2 rounded-full ${alert.severity === 'critical' ? 'bg-hazard animate-pulse' : 'bg-machine'}`} />
                        <span className="text-xs font-mono font-bold uppercase">{alert.type}</span>
                      </div>
                      <p className="text-xs text-muted-foreground truncate max-w-[200px]">{alert.message}</p>
                    </div>
                    <Button size="sm" variant="outline" className="h-7 text-[10px] font-mono uppercase tracking-wider" onClick={() => handleAcknowledge(alert.id)}>
                      Ack
                    </Button>
                  </div>
                ))}
                {!alerts?.length && (
                  <div className="p-4 text-center text-xs text-muted-foreground font-mono uppercase">No pending alerts</div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="bg-card border-border shadow-md">
          <CardHeader className="border-b border-border/50 pb-4">
            <CardTitle className="font-mono text-sm uppercase tracking-wider flex items-center gap-2">
              <Activity className="w-4 h-4 text-primary" />
              Zone Status
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4">
            <div className="grid grid-cols-2 gap-4">
              {zoneStatus?.map(zone => (
                <div key={zone.zone} className="border border-border p-3 rounded bg-background">
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-mono text-sm font-bold uppercase">{zone.zone}</span>
                    <span className={`text-[10px] px-2 py-0.5 rounded font-mono uppercase ${zone.status === 'active' ? 'bg-safe/20 text-safe border border-safe/20' : 'bg-hazard/20 text-hazard border border-hazard/20'}`}>
                      {zone.status}
                    </span>
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-center">
                    <div className="flex flex-col">
                      <span className="text-[10px] text-muted-foreground uppercase">Wrk</span>
                      <span className="font-mono text-sm">{zone.workerCount}</span>
                    </div>
                    <div className="flex flex-col">
                      <span className="text-[10px] text-muted-foreground uppercase">Mch</span>
                      <span className="font-mono text-sm">{zone.machineCount}</span>
                    </div>
                    <div className="flex flex-col">
                      <span className="text-[10px] text-muted-foreground uppercase">Hzd</span>
                      <span className="font-mono text-sm text-hazard">{zone.hazardCount}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card border-border shadow-md">
          <CardHeader className="border-b border-border/50 pb-4">
            <CardTitle className="font-mono text-sm uppercase tracking-wider flex items-center gap-2">
              <Activity className="w-4 h-4 text-primary" />
              Activity Feed
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0 h-[300px] overflow-y-auto custom-scrollbar">
            <div className="divide-y divide-border/50">
              {recentActivity?.map(activity => (
                <div key={activity.id} className="p-3 flex items-start gap-3 hover:bg-muted/50 transition-colors">
                  <span className="text-xs font-mono text-muted-foreground shrink-0 mt-0.5">
                    {format(new Date(activity.createdAt), "HH:mm")}
                  </span>
                  <div>
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-primary/10 text-primary uppercase border border-primary/20">{activity.type}</span>
                      {activity.zone && <span className="text-[10px] font-mono text-muted-foreground border border-border px-1.5 py-0.5 rounded">{activity.zone}</span>}
                    </div>
                    <p className="text-xs text-foreground">{activity.message}</p>
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

function StatCard({ title, value, icon: Icon, color }: { title: string, value: string | number, icon: any, color: string }) {
  return (
    <Card className="bg-card border-border shadow-sm hover:border-primary/50 transition-colors">
      <CardContent className="p-4 flex flex-col items-center text-center">
        <Icon className={`w-6 h-6 mb-2 ${color}`} />
        <span className="text-2xl font-bold font-mono text-foreground">{value}</span>
        <span className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider mt-1">{title}</span>
      </CardContent>
    </Card>
  );
}
