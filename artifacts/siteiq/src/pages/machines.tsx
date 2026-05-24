import { useState, useEffect } from "react";
import { useListMachines, useUpdateMachine, getListMachinesQueryKey } from "@workspace/api-client-react";
import { socket } from "@/lib/socket";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Truck, Activity, Wrench, User, Filter, AlertTriangle, MapPin } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";

export default function Machines() {
  const [statusFilter, setStatusFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [machinePositions, setMachinePositions] = useState<Record<number, {x: number, y: number}>>({});
  
  const { data: machines, isLoading } = useListMachines({
    status: statusFilter !== 'all' ? statusFilter : undefined
  });
  
  const updateMachine = useUpdateMachine();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  useEffect(() => {
    socket.connect();
    const handlePositions = (data: any) => {
      if (data.machines) {
        const newPos: Record<number, {x: number, y: number}> = {};
        data.machines.forEach((m: any) => newPos[m.id] = {x: m.x, y: m.y});
        setMachinePositions(prev => ({...prev, ...newPos}));
      }
    };
    socket.on("positions", handlePositions);
    return () => {
      socket.off("positions", handlePositions);
      socket.disconnect();
    };
  }, []);

  const handleFlagMaintenance = (id: number, name: string) => {
    updateMachine.mutate({ id, data: { status: "maintenance" } }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListMachinesQueryKey() });
        toast({ title: "Maintenance Flagged", description: `${name} marked for service.`, variant: "destructive" });
      }
    });
  };

  const getStatusColor = (status: string) => {
    switch(status) {
      case 'active': return 'border-safe text-safe bg-safe/10';
      case 'maintenance': return 'border-warning text-warning bg-warning/10';
      case 'conflict': return 'border-critical text-critical bg-critical/10';
      default: return 'border-muted text-muted-foreground bg-muted/20';
    }
  };

  const getTypeColor = (type: string) => {
    switch(type.toLowerCase()) {
      case 'crane': return 'border-blue-500 text-blue-500';
      case 'forklift': return 'border-orange-500 text-orange-500';
      case 'excavator': return 'border-yellow-500 text-yellow-500';
      default: return 'border-purple-500 text-purple-500';
    }
  };

  const filteredMachines = machines?.filter(m => 
    typeFilter === 'all' || m.type.toLowerCase() === typeFilter.toLowerCase()
  );

  return (
    <div className="space-y-6 fade-in-up">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-mono font-bold tracking-tight text-foreground uppercase flex items-center gap-3">
            <Truck className="w-8 h-8 text-machine" /> Machine Fleet
          </h1>
          <p className="text-sm font-mono text-muted-foreground mt-1 uppercase tracking-widest">Heavy Equipment Telemetry</p>
        </div>
        
        <div className="flex gap-2">
          <Select value={typeFilter} onValueChange={setTypeFilter}>
            <SelectTrigger className="w-[140px] font-mono bg-card border-border"><Filter className="w-3 h-3 mr-2"/> <SelectValue placeholder="Type"/></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Types</SelectItem>
              <SelectItem value="crane">Crane</SelectItem>
              <SelectItem value="forklift">Forklift</SelectItem>
              <SelectItem value="excavator">Excavator</SelectItem>
              <SelectItem value="mixer">Mixer</SelectItem>
            </SelectContent>
          </Select>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[140px] font-mono bg-card border-border"><SelectValue placeholder="Status" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="idle">Idle</SelectItem>
              <SelectItem value="maintenance">Maintenance</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {isLoading ? (
          [...Array(8)].map((_, i) => <div key={i} className="h-64 bg-card/40 rounded border border-border animate-pulse" />)
        ) : filteredMachines?.map((machine) => (
          <Card key={machine.id} className="bg-card border-border hover:border-machine/40 transition-all relative overflow-hidden group rounded-sm">
            <div className={`absolute top-0 left-0 w-full h-1 ${machine.status === 'active' ? 'bg-safe shadow-[0_0_10px_var(--color-safe)]' : machine.status === 'maintenance' ? 'bg-warning shadow-[0_0_10px_var(--color-warning)]' : machine.status === 'conflict' ? 'bg-critical shadow-[0_0_10px_var(--color-critical)]' : 'bg-muted'}`} />
            <CardHeader className="p-4 pb-2">
              <div className="flex justify-between items-start mb-2">
                <Badge variant="outline" className={`font-mono text-[9px] uppercase tracking-wider px-1.5 py-0 ${getStatusColor(machine.status)}`}>
                  {machine.status}
                </Badge>
                <Badge variant="outline" className={`font-mono text-[9px] uppercase tracking-wider px-1.5 py-0 bg-background ${getTypeColor(machine.type)}`}>
                  {machine.type}
                </Badge>
              </div>
              <CardTitle className="font-mono text-lg font-bold uppercase tracking-tight">{machine.name}</CardTitle>
              <div className="flex items-center gap-1 text-[10px] font-mono text-muted-foreground uppercase mt-1">
                <MapPin className="w-3 h-3 text-machine" /> Zone {machine.zone}
                {machinePositions[machine.id] && (
                  <span className="ml-2 text-machine/70 opacity-0 group-hover:opacity-100 transition-opacity">
                    [{machinePositions[machine.id].x.toFixed(1)}, {machinePositions[machine.id].y.toFixed(1)}]
                  </span>
                )}
              </div>
            </CardHeader>
            <CardContent className="p-4 pt-2 space-y-4">
              <div className="bg-muted/10 p-2 border border-border/50 rounded">
                <div className="flex justify-between text-[10px] font-mono uppercase mb-1">
                  <span className="text-muted-foreground flex items-center gap-1"><Activity className="w-3 h-3 text-machine"/> Output</span>
                  <span className="text-foreground">{machine.utilizationPct || 0}%</span>
                </div>
                <div className="h-1.5 w-full bg-background rounded-full overflow-hidden border border-border">
                   <div className={`h-full ${(machine.utilizationPct || 0) > 80 ? "bg-warning" : "bg-machine"}`} style={{width: `${machine.utilizationPct || 0}%`}} />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 text-[10px] font-mono uppercase">
                <div className="bg-background p-2 border border-border flex flex-col gap-1 rounded-sm">
                  <span className="text-muted-foreground flex items-center gap-1"><User className="w-3 h-3"/> Operator</span>
                  <span className="text-foreground font-bold">{machine.operatorId ? `OP-${machine.operatorId}` : 'None'}</span>
                </div>
                <div className="bg-background p-2 border border-border flex flex-col gap-1 rounded-sm">
                  <span className="text-muted-foreground flex items-center gap-1"><Wrench className="w-3 h-3"/> Service</span>
                  <span className={`font-bold ${new Date(machine.maintenanceDue || '').getTime() < Date.now() ? 'text-critical' : 'text-foreground'}`}>
                    {machine.maintenanceDue ? new Date(machine.maintenanceDue).toLocaleDateString(undefined, {month: 'numeric', day: 'numeric'}) : 'N/A'}
                  </span>
                </div>
              </div>

              {machine.status !== 'maintenance' && (
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="w-full font-mono text-[10px] uppercase tracking-widest border-warning/30 text-warning hover:bg-warning/10 hover:text-warning"
                  onClick={() => handleFlagMaintenance(machine.id, machine.name)}
                  disabled={updateMachine.isPending}
                >
                  <AlertTriangle className="w-3 h-3 mr-2" /> Flag Service
                </Button>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
