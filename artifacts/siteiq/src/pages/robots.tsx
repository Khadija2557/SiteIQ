import { useListRobots } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Cpu, Battery, Radio } from "lucide-react";

export default function Robots() {
  const { data: robots, isLoading } = useListRobots();

  return (
    <div className="space-y-6 fade-in-up">
      <div>
        <h1 className="text-3xl font-mono font-bold tracking-tight text-foreground uppercase flex items-center gap-3">
          <Cpu className="w-8 h-8 text-primary" />
          Autonomous Fleet
        </h1>
        <p className="text-sm font-mono text-muted-foreground mt-1 uppercase tracking-widest">Drone & Rover Management</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {isLoading ? (
          [...Array(4)].map((_, i) => (
            <div key={i} className="h-48 bg-card/40 rounded-xl border border-border animate-pulse" />
          ))
        ) : robots?.map((robot) => (
          <Card key={robot.id} className="bg-card/40 backdrop-blur border-border hover:border-primary/40 transition-all relative overflow-hidden group">
            <div className={`absolute top-0 left-0 w-full h-1 ${
              robot.status === 'active' ? 'bg-primary shadow-[0_0_10px_rgba(var(--primary),0.5)]' : 
              robot.status === 'charging' ? 'bg-warning' : 'bg-muted'
            }`} />
            <CardHeader className="pb-2">
              <div className="flex justify-between items-start mb-2">
                <Badge variant="outline" className={`font-mono text-[10px] uppercase ${
                  robot.status === 'active' ? 'border-primary text-primary bg-primary/10' :
                  robot.status === 'charging' ? 'border-warning text-warning bg-warning/10' :
                  'border-muted text-muted-foreground bg-muted/20'
                }`}>
                  {robot.status}
                </Badge>
                <span className="font-mono text-xs text-muted-foreground uppercase flex items-center gap-1">
                  <Radio className="w-3 h-3 animate-pulse text-primary"/> Link OK
                </span>
              </div>
              <CardTitle className="font-mono text-lg">{robot.name}</CardTitle>
              <p className="text-xs font-mono text-muted-foreground uppercase tracking-widest">{robot.type}</p>
            </CardHeader>
            <CardContent>
              <div className="bg-background/50 p-3 rounded border border-border flex justify-between items-center mt-2">
                <div className="flex flex-col gap-1">
                  <span className="text-muted-foreground uppercase text-[9px]">Current Task</span>
                  <span className="font-mono text-xs text-foreground">
                    {robot.currentTaskId ? `TSK-${robot.currentTaskId.toString().padStart(4, '0')}` : 'Idle'}
                  </span>
                </div>
                <div className="flex items-center gap-1.5 text-safe">
                  <Battery className="w-4 h-4" />
                  <span className="font-mono text-xs">98%</span>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
