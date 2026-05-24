import { useListHazards, useResolveHazard, getListHazardsQueryKey } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { AlertTriangle, MapPin, CheckCircle } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";

export default function Hazards() {
  const { data: hazards, isLoading } = useListHazards();
  const resolveHazard = useResolveHazard();
  const queryClient = useQueryClient();

  const handleResolve = (id: number) => {
    resolveHazard.mutate(
      { id },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListHazardsQueryKey() });
        }
      }
    );
  };

  const getSeverityColor = (severity: string) => {
    switch(severity) {
      case 'critical': return 'border-critical text-critical bg-critical/10 shadow-[0_0_10px_rgba(var(--color-critical),0.2)]';
      case 'high': return 'border-warning text-warning bg-warning/10';
      case 'medium': return 'border-info text-info bg-info/10';
      default: return 'border-safe text-safe bg-safe/10';
    }
  };

  return (
    <div className="space-y-6 fade-in-up">
      <div>
        <h1 className="text-3xl font-mono font-bold tracking-tight text-foreground uppercase flex items-center gap-3">
          <AlertTriangle className="w-8 h-8 text-critical animate-pulse" />
          Hazard Map
        </h1>
        <p className="text-sm font-mono text-muted-foreground mt-1 uppercase tracking-widest">Active Safety Threats & Violations</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-4">
          <Card className="bg-card/40 backdrop-blur border-border h-[600px] flex items-center justify-center relative overflow-hidden">
             {/* Mock map visualization */}
             <div className="absolute inset-0 opacity-20 pointer-events-none" 
                  style={{ backgroundImage: 'radial-gradient(var(--color-primary) 1px, transparent 1px)', backgroundSize: '40px 40px' }} />
             
             {hazards?.filter(h => h.active).map(hazard => (
                <div key={`map-${hazard.id}`} 
                     className="absolute flex flex-col items-center gap-1 group"
                     style={{ 
                       left: `${(hazard.locationX || 50)}%`, 
                       top: `${(hazard.locationY || 50)}%`,
                       transform: 'translate(-50%, -50%)'
                     }}>
                  <div className={`w-4 h-4 rounded-full ${
                    hazard.severity === 'critical' ? 'bg-critical shadow-[0_0_15px_var(--color-critical)] animate-pulse' :
                    hazard.severity === 'high' ? 'bg-warning shadow-[0_0_10px_var(--color-warning)]' :
                    'bg-info shadow-[0_0_10px_var(--color-info)]'
                  }`} />
                  <div className="opacity-0 group-hover:opacity-100 transition-opacity bg-background/90 border border-border p-2 rounded text-xs font-mono whitespace-nowrap z-10 absolute top-full mt-2">
                    {hazard.type}
                  </div>
                </div>
             ))}
             
             {!hazards?.filter(h => h.active).length && !isLoading && (
                <p className="font-mono text-muted-foreground uppercase tracking-widest">No Active Hazards Detected</p>
             )}
          </Card>
        </div>

        <div className="space-y-4 max-h-[600px] overflow-y-auto custom-scrollbar pr-2">
          {isLoading ? (
             [...Array(4)].map((_, i) => <div key={i} className="h-32 bg-card/40 rounded-xl border border-border animate-pulse" />)
          ) : hazards?.filter(h => h.active).map((hazard) => (
            <Card key={hazard.id} className="bg-card/40 backdrop-blur border-border relative overflow-hidden">
               {hazard.severity === 'critical' && (
                 <div className="absolute top-0 left-0 w-1 h-full bg-critical shadow-[0_0_10px_var(--color-critical)]" />
               )}
               <CardHeader className="p-4 pb-2">
                 <div className="flex justify-between items-start gap-2">
                    <Badge variant="outline" className={`font-mono text-[10px] uppercase ${getSeverityColor(hazard.severity)}`}>
                      {hazard.severity}
                    </Badge>
                    <span className="text-[10px] font-mono text-muted-foreground flex items-center gap-1 uppercase">
                      <MapPin className="w-3 h-3" /> Zone {hazard.zone}
                    </span>
                 </div>
                 <CardTitle className="font-mono text-sm mt-2">{hazard.type}</CardTitle>
               </CardHeader>
               <CardContent className="p-4 pt-0">
                 <p className="text-xs text-muted-foreground mb-4">{hazard.description}</p>
                 <div className="flex justify-between items-center">
                   <span className="text-[10px] font-mono text-muted-foreground uppercase">
                     Detected: {new Date(hazard.detectedAt).toLocaleTimeString()}
                   </span>
                   <Button 
                     size="sm" 
                     variant="outline" 
                     className="font-mono text-[10px] h-7 hover:bg-safe/10 hover:text-safe hover:border-safe/30 transition-colors"
                     onClick={() => handleResolve(hazard.id)}
                     disabled={resolveHazard.isPending}
                   >
                     <CheckCircle className="w-3 h-3 mr-1" />
                     Resolve
                   </Button>
                 </div>
               </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}
