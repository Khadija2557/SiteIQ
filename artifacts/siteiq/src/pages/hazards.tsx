import { useState } from "react";
import { useListHazards, useResolveHazard, useCreateHazard, getListHazardsQueryKey } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel } from "@/components/ui/form";
import { AlertTriangle, MapPin, CheckCircle, Plus, Filter } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useToast } from "@/hooks/use-toast";

const hazardSchema = z.object({
  type: z.string().min(2),
  severity: z.string().min(1),
  zone: z.string().min(1),
  description: z.string().optional(),
});

export default function Hazards() {
  const [zoneFilter, setZoneFilter] = useState("all");
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [showResolved, setShowResolved] = useState(false);

  const { data: hazards, isLoading } = useListHazards({
    zone: zoneFilter !== 'all' ? zoneFilter : undefined
  });
  const resolveHazard = useResolveHazard();
  const createHazard = useCreateHazard();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const form = useForm<z.infer<typeof hazardSchema>>({
    resolver: zodResolver(hazardSchema),
    defaultValues: { type: "", severity: "high", zone: "A", description: "" }
  });

  const onSubmit = (data: z.infer<typeof hazardSchema>) => {
    createHazard.mutate({ data }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListHazardsQueryKey() });
        setIsAddOpen(false);
        form.reset();
        toast({ title: "Hazard Logged", description: "System updated with new threat vector." });
      }
    });
  };

  const handleResolve = (id: number) => {
    resolveHazard.mutate(
      { id },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListHazardsQueryKey() });
          toast({ title: "Hazard Resolved", description: "Threat neutralized." });
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
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-mono font-bold tracking-tight text-foreground uppercase flex items-center gap-3">
            <AlertTriangle className="w-8 h-8 text-critical animate-pulse" />
            Hazard Tracker
          </h1>
          <p className="text-sm font-mono text-muted-foreground mt-1 uppercase tracking-widest">Safety Threats & Incidents</p>
        </div>

        <div className="flex items-center gap-3">
          <Select value={zoneFilter} onValueChange={setZoneFilter}>
            <SelectTrigger className="w-[120px] font-mono bg-card border-border"><Filter className="w-3 h-3 mr-2"/> <SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Zones</SelectItem>
              {['A','B','C','D'].map(z => <SelectItem key={z} value={z}>Zone {z}</SelectItem>)}
            </SelectContent>
          </Select>
          
          <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
            <DialogTrigger asChild>
              <Button className="font-mono uppercase tracking-wider bg-critical text-critical-foreground hover:bg-critical/80"><Plus className="w-4 h-4 mr-2" /> Log Hazard</Button>
            </DialogTrigger>
            <DialogContent className="bg-card border-border shadow-[0_0_40px_rgba(var(--color-critical),0.15)]">
              <DialogHeader><DialogTitle className="font-mono uppercase tracking-widest text-critical flex items-center gap-2"><AlertTriangle className="w-5 h-5"/> Report Threat</DialogTitle></DialogHeader>
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                  <FormField control={form.control} name="type" render={({ field }) => (
                    <FormItem><FormLabel className="font-mono text-xs uppercase">Hazard Type</FormLabel><FormControl><Input className="font-mono bg-background border-border" placeholder="e.g. Chemical Spill" {...field} /></FormControl></FormItem>
                  )} />
                  <div className="grid grid-cols-2 gap-4">
                    <FormField control={form.control} name="severity" render={({ field }) => (
                      <FormItem><FormLabel className="font-mono text-xs uppercase">Severity</FormLabel><Select onValueChange={field.onChange} defaultValue={field.value}><FormControl><SelectTrigger className="font-mono bg-background border-border"><SelectValue /></SelectTrigger></FormControl><SelectContent><SelectItem value="critical">Critical</SelectItem><SelectItem value="high">High</SelectItem><SelectItem value="medium">Medium</SelectItem><SelectItem value="low">Low</SelectItem></SelectContent></Select></FormItem>
                    )} />
                    <FormField control={form.control} name="zone" render={({ field }) => (
                      <FormItem><FormLabel className="font-mono text-xs uppercase">Zone</FormLabel><Select onValueChange={field.onChange} defaultValue={field.value}><FormControl><SelectTrigger className="font-mono bg-background border-border"><SelectValue /></SelectTrigger></FormControl><SelectContent>{['A','B','C','D'].map(z => <SelectItem key={z} value={z}>Zone {z}</SelectItem>)}</SelectContent></Select></FormItem>
                    )} />
                  </div>
                  <FormField control={form.control} name="description" render={({ field }) => (
                    <FormItem><FormLabel className="font-mono text-xs uppercase">Details</FormLabel><FormControl><Input className="font-mono bg-background border-border" {...field} /></FormControl></FormItem>
                  )} />
                  <Button type="submit" className="w-full font-mono uppercase bg-critical hover:bg-critical/90" disabled={createHazard.isPending}>Submit Report</Button>
                </form>
              </Form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-4">
          <Card className="bg-card border-border h-[600px] flex items-center justify-center relative overflow-hidden rounded-sm shadow-md">
             {/* Map visualization */}
             <div className="absolute inset-0 opacity-10 pointer-events-none bg-primary/5" 
                  style={{ backgroundImage: 'linear-gradient(var(--color-primary) 1px, transparent 1px), linear-gradient(90deg, var(--color-primary) 1px, transparent 1px)', backgroundSize: '20px 20px' }} />
             
             {hazards?.filter(h => h.active).map(hazard => (
                <div key={`map-${hazard.id}`} 
                     className="absolute flex flex-col items-center gap-1 group cursor-pointer"
                     style={{ 
                       left: `${(hazard.locationX || Math.random() * 80 + 10)}%`, 
                       top: `${(hazard.locationY || Math.random() * 80 + 10)}%`,
                       transform: 'translate(-50%, -50%)'
                     }}>
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center border-2 border-background shadow-lg ${
                    hazard.severity === 'critical' ? 'bg-critical shadow-[0_0_15px_var(--color-critical)] animate-pulse' :
                    hazard.severity === 'high' ? 'bg-warning shadow-[0_0_10px_var(--color-warning)]' :
                    'bg-info shadow-[0_0_10px_var(--color-info)]'
                  }`}>
                    <AlertTriangle className="w-3 h-3 text-white" />
                  </div>
                  <div className="opacity-0 group-hover:opacity-100 transition-opacity bg-background border border-border p-2 rounded text-[10px] font-mono uppercase whitespace-nowrap z-10 absolute top-full mt-2 pointer-events-none">
                    <span className={getSeverityColor(hazard.severity).split(' ')[1]}>{hazard.severity}</span>: {hazard.type}
                  </div>
                </div>
             ))}
             
             {!hazards?.filter(h => h.active).length && !isLoading && (
                <div className="font-mono text-safe uppercase tracking-widest flex flex-col items-center opacity-50">
                  <CheckCircle className="w-12 h-12 mb-2" />
                  Sector Clear
                </div>
             )}
          </Card>
        </div>

        <div className="space-y-4 max-h-[600px] overflow-y-auto custom-scrollbar pr-2">
          {isLoading ? (
             [...Array(4)].map((_, i) => <div key={i} className="h-32 bg-card rounded border border-border animate-pulse" />)
          ) : hazards?.filter(h => h.active).map((hazard) => (
            <Card key={hazard.id} className="bg-card border-border relative overflow-hidden rounded-sm group">
               {hazard.severity === 'critical' && (
                 <div className="absolute top-0 left-0 w-1 h-full bg-critical shadow-[0_0_10px_var(--color-critical)]" />
               )}
               <CardHeader className="p-4 pb-2">
                 <div className="flex justify-between items-start gap-2">
                    <Badge variant="outline" className={`font-mono text-[9px] uppercase px-1.5 py-0 ${getSeverityColor(hazard.severity)}`}>
                      {hazard.severity}
                    </Badge>
                    <span className="text-[10px] font-mono text-muted-foreground flex items-center gap-1 uppercase bg-muted/20 px-1.5 py-0.5 rounded">
                      <MapPin className="w-3 h-3" /> Zone {hazard.zone}
                    </span>
                 </div>
                 <CardTitle className="font-mono text-sm mt-2 uppercase">{hazard.type}</CardTitle>
               </CardHeader>
               <CardContent className="p-4 pt-0">
                 {hazard.description && <p className="text-[10px] text-muted-foreground mb-4 font-mono">{hazard.description}</p>}
                 <div className="flex justify-between items-center mt-3 pt-3 border-t border-border/50">
                   <span className="text-[9px] font-mono text-muted-foreground uppercase tracking-widest">
                     {new Date(hazard.detectedAt).toLocaleTimeString()}
                   </span>
                   <Button 
                     size="sm" 
                     variant="outline" 
                     className="font-mono text-[9px] h-7 uppercase border-safe/30 text-safe hover:bg-safe/10 hover:text-safe"
                     onClick={() => handleResolve(hazard.id)}
                     disabled={resolveHazard.isPending}
                   >
                     <CheckCircle className="w-3 h-3 mr-1" /> Clear
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
