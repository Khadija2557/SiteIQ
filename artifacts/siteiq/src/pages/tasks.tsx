import { useListTasks } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CheckSquare, Clock, AlertTriangle } from "lucide-react";
import { Badge } from "@/components/ui/badge";

export default function Tasks() {
  const { data: tasks, isLoading } = useListTasks();

  const getPriorityColor = (priority: string) => {
    switch(priority) {
      case 'critical': return 'border-critical text-critical bg-critical/10';
      case 'high': return 'border-warning text-warning bg-warning/10';
      case 'medium': return 'border-info text-info bg-info/10';
      default: return 'border-muted text-muted-foreground bg-muted/20';
    }
  };

  return (
    <div className="space-y-6 fade-in-up">
      <div>
        <h1 className="text-3xl font-mono font-bold tracking-tight text-foreground uppercase flex items-center gap-3">
          <CheckSquare className="w-8 h-8 text-primary" />
          Task Board
        </h1>
        <p className="text-sm font-mono text-muted-foreground mt-1 uppercase tracking-widest">Active Operations & Objectives</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {['todo', 'in_progress', 'blocked', 'complete'].map((status) => (
          <div key={status} className="space-y-4">
            <h3 className="font-mono text-sm uppercase tracking-widest text-muted-foreground border-b border-border pb-2 flex justify-between items-center">
              {status.replace('_', ' ')}
              <span className="bg-muted px-2 py-0.5 rounded text-[10px]">{tasks?.filter(t => t.status === status).length || 0}</span>
            </h3>
            
            <div className="space-y-3">
              {isLoading ? (
                <div className="h-32 bg-card/40 rounded-xl border border-border animate-pulse" />
              ) : tasks?.filter(t => t.status === status).map((task) => (
                <Card key={task.id} className="bg-card/60 backdrop-blur border-border hover:border-primary/40 transition-colors">
                  <CardHeader className="p-4 pb-2">
                    <div className="flex justify-between items-start gap-2">
                      <CardTitle className="text-sm font-mono leading-tight">{task.title}</CardTitle>
                      <Badge variant="outline" className={`font-mono text-[10px] shrink-0 ${getPriorityColor(task.priority)}`}>
                        {task.priority}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="p-4 pt-0">
                    <p className="text-xs text-muted-foreground mb-4 line-clamp-2">{task.description}</p>
                    <div className="flex justify-between items-center text-[10px] font-mono text-muted-foreground uppercase">
                      <span>Zone {task.zone}</span>
                      {task.estimatedMinutes && (
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3" /> {task.estimatedMinutes}m
                        </span>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
