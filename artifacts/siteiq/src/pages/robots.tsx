import { useListRobots, useUpdateRobot, getListRobotsQueryKey } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Cpu, Battery, Radio, RefreshCw } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";

export default function Robots() {
  const { data: robots, isLoading } = useListRobots();
  const updateRobot = useUpdateRobot();
  const queryClient = useQueryClient();

  const handleUpdateStatus = (id: number, currentStatus: string) => {
    let nextStatus = currentStatus === 'active' ? 'charging' : currentStatus === 'charging' ? 'idle' : 'active';
    updateRobot.mutate(
      { id, data: { status: nextStatus } },
      {
        onSuccess: () => queryClient.invalidateQueries({ queryKey: getListRobotsQueryKey() })
      }
    );
  };

  return (
    <div className="space-y-6 fade-in-up">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-mono font-bold tracking-tight text-foreground uppercase flex items-center gap-3">
            <Cpu className="w-8 h-8 text-ai" />
            Autonomous Fleet
          </h1>
          <p className="text-sm font-mono text-muted-foreground mt-1 uppercase tracking-widest">AI-Driven Operations & Logistics</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {isLoading ? (
          [...Array(4)].map((_, i) => (
            <div key={i} className="h-48 bg-card rounded-sm border border-border animate-pulse" />
          ))
        ) : robots?.map((robot) => (
          <Card key={robot.id} className="bg-card border-border hover:border-ai/40 transition-all relative overflow-hidden group rounded-sm shadow-md">
            <div className={`absolute top-0 left-0 w-full h-1 ${
              robot.status === 'active' ? 'bg-ai shadow-[0_0_15px_var(--color-ai)]' : 
              robot.status === 'charging' ? 'bg-warning' : 'bg-muted'
            }`} />
            
            <div className="absolute top-0 right-0 p-1 opacity-10 pointer-events-none">
              <Cpu className="w-24 h-24 text-ai" />
            </div>

            <CardHeader className="pb-2 relative z-10">
              <div className="flex justify-between items-start mb-2">
                <Badge variant="outline" className={`font-mono text-[9px] uppercase tracking-wider px-1.5 py-0 ${
                  robot.status === 'active' ? 'border-ai text-ai bg-ai/10' :
                  robot.status === 'charging' ? 'border-warning text-warning bg-warning/10' :
                  'border-muted text-muted-foreground bg-muted/20'
                }`}>
                  {robot.status}
                </Badge>
                <span className={`font-mono text-[10px] uppercase flex items-center gap-1 ${robot.status === 'active' ? 'text-ai' : 'text-muted-foreground'}`}>
                  <Radio className={`w-3 h-3 ${robot.status === 'active' ? 'animate-pulse' : ''}`}/> Link OK
                </span>
              </div>
              <CardTitle className="font-mono text-lg font-bold uppercase tracking-tight text-foreground">{robot.name}</CardTitle>
              <p className="text-[10px] font-mono text-muted-foreground uppercase tracking-widest border border-border bg-background px-1.5 py-0.5 rounded max-w-fit mt-1">{robot.type}</p>
            </CardHeader>

            <CardContent className="relative z-10 pt-2 space-y-4">
              <div className="bg-background/80 p-3 rounded-sm border border-border/50 flex justify-between items-center backdrop-blur">
                <div className="flex flex-col gap-1">
                  <span className="text-muted-foreground uppercase text-[9px] font-mono tracking-widest">Assigned Directive</span>
                  <span className="font-mono text-[11px] font-bold text-foreground">
                    {robot.currentTaskId ? `TSK-${robot.currentTaskId.toString().padStart(4, '0')}` : 'Standby'}
                  </span>
                </div>
                <div className={`flex items-center gap-1.5 font-mono text-xs ${robot.status === 'charging' ? 'text-warning animate-pulse' : 'text-safe'}`}>
                  <Battery className="w-4 h-4" />
                  {robot.status === 'charging' ? 'CHG' : '98%'}
                </div>
              </div>

              <Button 
                variant="outline" 
                size="sm" 
                className="w-full font-mono text-[9px] uppercase tracking-widest border-ai/30 text-ai hover:bg-ai/10 hover:text-ai"
                onClick={() => handleUpdateStatus(robot.id, robot.status)}
                disabled={updateRobot.isPending}
              >
                <RefreshCw className="w-3 h-3 mr-2" /> Cycle State
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
