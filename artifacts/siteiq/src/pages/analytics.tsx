import { useGetWorkerStats, useGetTaskStats, useGetDashboardSummary } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart2, Activity, Shield, Clock, Wrench } from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line
} from "recharts";

import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip as ChartTooltip,
  Legend,
  ArcElement,
  PointElement,
  LineElement
} from 'chart.js';

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  ChartTooltip,
  Legend,
  ArcElement,
  PointElement,
  LineElement
);

export default function Analytics() {
  const { data: workerStats, isLoading: isLoadingWorkers } = useGetWorkerStats();
  const { data: taskStats, isLoading: isLoadingTasks } = useGetTaskStats();
  const { data: summary } = useGetDashboardSummary();

  const pieColors = {
    todo: "hsl(222 36% 18%)",
    in_progress: "hsl(189 94% 43%)",
    blocked: "hsl(0 84% 60%)",
    complete: "hsl(160 84% 39%)"
  };

  const taskStatusData = taskStats ? [
    { name: "To Do", value: taskStats.todo, fill: pieColors.todo },
    { name: "Active", value: taskStats.inProgress, fill: pieColors.in_progress },
    { name: "Blocked", value: taskStats.blocked, fill: pieColors.blocked },
    { name: "Done", value: taskStats.complete, fill: pieColors.complete },
  ] : [];

  const ppeData = workerStats ? [
    { name: "Compliant", value: workerStats.avgPpeScore, fill: "hsl(160 84% 39%)" },
    { name: "Violations", value: 100 - workerStats.avgPpeScore, fill: "hsl(0 84% 60%)" }
  ] : [];

  if (isLoadingWorkers || isLoadingTasks) {
    return (
      <div className="space-y-6 animate-pulse">
         <div className="h-8 w-64 bg-muted rounded"></div>
         <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="h-80 bg-card rounded-sm border border-border"></div>
            <div className="h-80 bg-card rounded-sm border border-border"></div>
         </div>
      </div>
    );
  }

  // Derived risk scores (mocked based on actual stats logic)
  const safetyRisk = Math.min(10, ((summary?.activeHazards || 0) / Math.max(summary?.totalWorkers || 1, 1)) * 5 + ((100 - (workerStats?.avgPpeScore || 100)) / 10)).toFixed(1);
  const delayProb = Math.min(10, ((taskStats?.blocked || 0) / Math.max(taskStats?.total || 1, 1)) * 10).toFixed(1);
  const fatigueIndex = ((workerStats?.avgFatigueScore || 0) / 10).toFixed(1);
  
  return (
    <div className="space-y-6 fade-in-up">
      <div>
        <h1 className="text-3xl font-mono font-bold tracking-tight text-foreground uppercase flex items-center gap-3">
          <BarChart2 className="w-8 h-8 text-primary" /> Telemetry
        </h1>
        <p className="text-sm font-mono text-muted-foreground mt-1 uppercase tracking-widest">Predictive Analytics & Historical Data</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
         <RiskCard title="Safety Risk Index" value={safetyRisk} icon={Shield} type="critical" max={10} />
         <RiskCard title="Delay Probability" value={delayProb} icon={Clock} type="warning" max={10} />
         <RiskCard title="Fleet Fatigue" value={fatigueIndex} icon={Activity} type="info" max={10} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* Task Status */}
        <Card className="bg-card border-border rounded-sm shadow-sm">
          <CardHeader className="border-b border-border/50 pb-3">
            <CardTitle className="font-mono text-sm uppercase tracking-widest flex items-center gap-2">
               Objective States
            </CardTitle>
          </CardHeader>
          <CardContent className="h-[300px] flex items-center justify-center p-4">
             <ResponsiveContainer width="100%" height="100%">
                <BarChart data={taskStatusData} layout="vertical" margin={{ left: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" horizontal={false} />
                  <XAxis type="number" stroke="hsl(var(--muted-foreground))" fontSize={10} tickLine={false} axisLine={false} />
                  <YAxis dataKey="name" type="category" stroke="hsl(var(--muted-foreground))" fontSize={10} tickLine={false} axisLine={false} />
                  <Tooltip 
                     contentStyle={{ backgroundColor: 'hsl(var(--card))', borderColor: 'hsl(var(--border))', borderRadius: '4px' }}
                     itemStyle={{ color: 'hsl(var(--foreground))', fontFamily: 'monospace', textTransform: 'uppercase' }}
                     cursor={{ fill: 'hsl(var(--muted)/0.2)' }}
                  />
                  <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                    {taskStatusData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.fill} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Worker Zone Distribution */}
        <Card className="bg-card border-border rounded-sm shadow-sm">
          <CardHeader className="border-b border-border/50 pb-3">
            <CardTitle className="font-mono text-sm uppercase tracking-widest flex items-center gap-2">
               Personnel Heatmap
            </CardTitle>
          </CardHeader>
          <CardContent className="h-[300px] p-4">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={workerStats?.byZone}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                <XAxis dataKey="zone" stroke="hsl(var(--muted-foreground))" fontSize={10} tickLine={false} axisLine={false} tickFormatter={(val) => `ZONE ${val}`} />
                <YAxis stroke="hsl(var(--muted-foreground))" fontSize={10} tickLine={false} axisLine={false} />
                <Tooltip 
                   contentStyle={{ backgroundColor: 'hsl(var(--card))', borderColor: 'hsl(var(--border))', borderRadius: '4px' }}
                   itemStyle={{ color: 'hsl(var(--primary))', fontFamily: 'monospace' }}
                   labelStyle={{ color: 'hsl(var(--muted-foreground))', fontFamily: 'monospace', textTransform: 'uppercase' }}
                   cursor={{ fill: 'hsl(var(--muted)/0.2)' }}
                />
                <Bar dataKey="count" fill="hsl(var(--worker))" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* PPE Compliance */}
        <Card className="bg-card border-border rounded-sm shadow-sm">
          <CardHeader className="border-b border-border/50 pb-3">
            <CardTitle className="font-mono text-sm uppercase tracking-widest flex items-center gap-2">
               PPE Adherence
            </CardTitle>
          </CardHeader>
          <CardContent className="h-[300px] flex items-center justify-center p-4 relative">
             <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={ppeData}
                    cx="50%"
                    cy="50%"
                    innerRadius={80}
                    outerRadius={100}
                    paddingAngle={2}
                    dataKey="value"
                    stroke="hsl(var(--card))"
                    strokeWidth={2}
                  >
                    {ppeData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.fill} />
                    ))}
                  </Pie>
                  <Tooltip 
                     contentStyle={{ backgroundColor: 'hsl(var(--card))', borderColor: 'hsl(var(--border))', borderRadius: '4px' }}
                     itemStyle={{ color: 'hsl(var(--foreground))', fontFamily: 'monospace' }}
                  />
                </PieChart>
              </ResponsiveContainer>
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none mt-4">
                 <div className="flex flex-col items-center">
                    <span className="text-4xl font-mono font-bold text-safe">{workerStats?.avgPpeScore}%</span>
                    <span className="text-[10px] font-mono text-muted-foreground uppercase tracking-widest mt-1">Compliance</span>
                 </div>
              </div>
          </CardContent>
        </Card>

        {/* Task Zone Distribution */}
        <Card className="bg-card border-border rounded-sm shadow-sm">
          <CardHeader className="border-b border-border/50 pb-3">
            <CardTitle className="font-mono text-sm uppercase tracking-widest flex items-center gap-2">
               Objective Density
            </CardTitle>
          </CardHeader>
          <CardContent className="h-[300px] p-4">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={taskStats?.byZone}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                <XAxis dataKey="zone" stroke="hsl(var(--muted-foreground))" fontSize={10} tickLine={false} axisLine={false} tickFormatter={(val) => `ZONE ${val}`} />
                <YAxis stroke="hsl(var(--muted-foreground))" fontSize={10} tickLine={false} axisLine={false} />
                <Tooltip 
                  contentStyle={{ backgroundColor: 'hsl(var(--card))', borderColor: 'hsl(var(--border))', borderRadius: '4px' }}
                  itemStyle={{ color: 'hsl(var(--foreground))', fontFamily: 'monospace' }}
                  labelStyle={{ color: 'hsl(var(--muted-foreground))', fontFamily: 'monospace', textTransform: 'uppercase' }}
                />
                <Line type="step" dataKey="count" stroke="hsl(var(--primary))" strokeWidth={2} dot={{ r: 4, fill: 'hsl(var(--card))', stroke: 'hsl(var(--primary))', strokeWidth: 2 }} activeDot={{ r: 6, fill: 'hsl(var(--primary))' }} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

      </div>
    </div>
  );
}

function RiskCard({ title, value, icon: Icon, type, max }: any) {
  const numValue = parseFloat(value);
  const percentage = (numValue / max) * 100;
  
  let colorClass = "text-info";
  let bgClass = "bg-info";
  if (type === 'critical' || numValue > 7) { colorClass = "text-critical"; bgClass = "bg-critical"; }
  else if (type === 'warning' || numValue > 4) { colorClass = "text-warning"; bgClass = "bg-warning"; }
  
  return (
    <Card className="bg-card border-border rounded-sm flex items-center p-4 gap-4">
      <div className="relative w-16 h-16 flex items-center justify-center shrink-0">
        <svg className="w-full h-full transform -rotate-90" viewBox="0 0 36 36">
          <path
            className="text-muted"
            d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
            fill="none"
            stroke="currentColor"
            strokeWidth="3"
          />
          <path
            className={colorClass}
            strokeDasharray={`${percentage}, 100`}
            d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
            fill="none"
            stroke="currentColor"
            strokeWidth="3"
            style={{ transition: "stroke-dasharray 1s ease" }}
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
           <span className={`font-mono font-bold text-sm ${colorClass}`}>{value}</span>
        </div>
      </div>
      <div>
        <div className="flex items-center gap-2 mb-1">
          <Icon className={`w-3 h-3 ${colorClass}`} />
          <h3 className="font-mono text-xs uppercase tracking-widest text-muted-foreground">{title}</h3>
        </div>
        <p className="text-xs text-foreground font-mono uppercase">Scale: 0 - 10</p>
      </div>
    </Card>
  );
}
