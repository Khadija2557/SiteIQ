import { useGetWorkerStats, useGetTaskStats } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart2, TrendingUp, Activity, CheckSquare } from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell
} from "recharts";

export default function Analytics() {
  const { data: workerStats, isLoading: isLoadingWorkers } = useGetWorkerStats();
  const { data: taskStats, isLoading: isLoadingTasks } = useGetTaskStats();

  const mockProductivityData = [
    { day: "Mon", value: 65 },
    { day: "Tue", value: 72 },
    { day: "Wed", value: 68 },
    { day: "Thu", value: 85 },
    { day: "Fri", value: 78 },
    { day: "Sat", value: 45 },
    { day: "Sun", value: 30 },
  ];

  const pieColors = {
    todo: "hsl(var(--muted-foreground))",
    in_progress: "hsl(var(--primary))",
    blocked: "hsl(var(--destructive))",
    complete: "hsl(var(--safe))"
  };

  const pieData = taskStats ? [
    { name: "To Do", value: taskStats.todo, fill: pieColors.todo },
    { name: "In Progress", value: taskStats.inProgress, fill: pieColors.in_progress },
    { name: "Blocked", value: taskStats.blocked, fill: pieColors.blocked },
    { name: "Complete", value: taskStats.complete, fill: pieColors.complete },
  ] : [];

  if (isLoadingWorkers || isLoadingTasks) {
    return (
      <div className="space-y-6 animate-pulse">
         <div className="h-8 w-64 bg-muted rounded"></div>
         <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="h-80 bg-card/40 rounded-xl border border-border"></div>
            <div className="h-80 bg-card/40 rounded-xl border border-border"></div>
         </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 fade-in-up">
      <div>
        <h1 className="text-3xl font-mono font-bold tracking-tight text-foreground uppercase flex items-center gap-3">
          <BarChart2 className="w-8 h-8 text-primary" />
          Analytics
        </h1>
        <p className="text-sm font-mono text-muted-foreground mt-1 uppercase tracking-widest">Historical & Predictive Telemetry</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="bg-card/40 backdrop-blur border-border">
          <CardHeader>
            <CardTitle className="font-mono text-sm uppercase tracking-widest flex items-center gap-2">
               <TrendingUp className="w-4 h-4 text-primary"/> Fleet Productivity Trend
            </CardTitle>
          </CardHeader>
          <CardContent className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={mockProductivityData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                <XAxis dataKey="day" stroke="hsl(var(--muted-foreground))" fontSize={10} tickLine={false} axisLine={false} />
                <YAxis stroke="hsl(var(--muted-foreground))" fontSize={10} tickLine={false} axisLine={false} />
                <Tooltip 
                  contentStyle={{ backgroundColor: 'hsl(var(--card))', borderColor: 'hsl(var(--border))', borderRadius: '8px' }}
                  itemStyle={{ color: 'hsl(var(--foreground))', fontFamily: 'monospace' }}
                  labelStyle={{ color: 'hsl(var(--muted-foreground))', fontFamily: 'monospace' }}
                />
                <Line type="monotone" dataKey="value" stroke="hsl(var(--primary))" strokeWidth={2} dot={{ r: 4, fill: 'hsl(var(--background))', stroke: 'hsl(var(--primary))', strokeWidth: 2 }} activeDot={{ r: 6, fill: 'hsl(var(--primary))' }} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="bg-card/40 backdrop-blur border-border">
          <CardHeader>
            <CardTitle className="font-mono text-sm uppercase tracking-widest flex items-center gap-2">
               <Activity className="w-4 h-4 text-primary"/> Zone Activity Distribution
            </CardTitle>
          </CardHeader>
          <CardContent className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={workerStats?.byZone}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                <XAxis dataKey="zone" stroke="hsl(var(--muted-foreground))" fontSize={10} tickLine={false} axisLine={false} />
                <YAxis stroke="hsl(var(--muted-foreground))" fontSize={10} tickLine={false} axisLine={false} />
                <Tooltip 
                   contentStyle={{ backgroundColor: 'hsl(var(--card))', borderColor: 'hsl(var(--border))', borderRadius: '8px' }}
                   itemStyle={{ color: 'hsl(var(--foreground))', fontFamily: 'monospace' }}
                   labelStyle={{ color: 'hsl(var(--muted-foreground))', fontFamily: 'monospace' }}
                   cursor={{ fill: 'hsl(var(--muted)/0.2)' }}
                />
                <Bar dataKey="count" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="bg-card/40 backdrop-blur border-border">
          <CardHeader>
            <CardTitle className="font-mono text-sm uppercase tracking-widest flex items-center gap-2">
               <CheckSquare className="w-4 h-4 text-primary"/> Task Status Overview
            </CardTitle>
          </CardHeader>
          <CardContent className="h-[300px] flex items-center justify-center">
             <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={pieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={80}
                    paddingAngle={5}
                    dataKey="value"
                    stroke="none"
                  >
                    {pieData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.fill} />
                    ))}
                  </Pie>
                  <Tooltip 
                     contentStyle={{ backgroundColor: 'hsl(var(--card))', borderColor: 'hsl(var(--border))', borderRadius: '8px' }}
                     itemStyle={{ color: 'hsl(var(--foreground))', fontFamily: 'monospace' }}
                  />
                </PieChart>
              </ResponsiveContainer>
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                 <div className="flex flex-col items-center">
                    <span className="text-3xl font-mono font-bold text-foreground">{taskStats?.total || 0}</span>
                    <span className="text-[10px] font-mono text-muted-foreground uppercase">Tasks</span>
                 </div>
              </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
