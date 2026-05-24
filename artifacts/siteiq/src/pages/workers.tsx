import { useState } from "react";
import { useListWorkers, useCreateWorker, useCreateHazard, getListWorkersQueryKey, useUpdateWorker } from "@workspace/api-client-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Users, Search, Plus, Filter, MessageSquare, AlertTriangle, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel } from "@/components/ui/form";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";

const workerSchema = z.object({
  name: z.string().min(2),
  trade: z.string().min(2),
  zone: z.string().min(1),
});

export default function Workers() {
  const [search, setSearch] = useState("");
  const [zoneFilter, setZoneFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [selectedWorker, setSelectedWorker] = useState<any>(null);
  const [isAddOpen, setIsAddOpen] = useState(false);
  
  const queryClient = useQueryClient();
  const { toast } = useToast();
  
  const { data: workers, isLoading } = useListWorkers({ 
    zone: zoneFilter !== 'all' ? zoneFilter : undefined,
    status: statusFilter !== 'all' ? statusFilter : undefined
  });
  
  const createWorker = useCreateWorker();
  const createHazard = useCreateHazard();

  const form = useForm<z.infer<typeof workerSchema>>({
    resolver: zodResolver(workerSchema),
    defaultValues: { name: "", trade: "", zone: "" }
  });

  const onSubmit = (data: z.infer<typeof workerSchema>) => {
    createWorker.mutate({ data }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListWorkersQueryKey() });
        setIsAddOpen(false);
        form.reset();
        toast({ title: "Worker Added", description: `${data.name} added to roster.` });
      }
    });
  };

  const handleMarkRisk = (workerId: number, zone: string) => {
    createHazard.mutate({
      data: { type: "Personnel Risk", severity: "high", zone, description: `Worker OP-${workerId.toString().padStart(4,'0')} flagged for risk.` }
    }, {
      onSuccess: () => {
        toast({ title: "Risk Flagged", description: "Hazard alert created successfully.", variant: "destructive" });
      }
    });
  };

  const handleSendMessage = (name: string) => {
    toast({ title: "Message Sent", description: `Message transmitted to ${name}.` });
  };

  const filteredWorkers = workers?.filter(w => w.name.toLowerCase().includes(search.toLowerCase()) || w.id.toString().includes(search));

  return (
    <div className="flex h-full gap-6">
      <div className={`flex-1 space-y-6 transition-all duration-300 ${selectedWorker ? 'mr-80' : ''}`}>
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-3xl font-mono font-bold tracking-tight text-foreground uppercase flex items-center gap-3">
              <Users className="w-8 h-8 text-primary" /> Personnel Roster
            </h1>
            <p className="text-sm font-mono text-muted-foreground mt-1 uppercase tracking-widest">Active Site Operators</p>
          </div>

          <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
            <DialogTrigger asChild>
              <Button className="font-mono uppercase tracking-wider"><Plus className="w-4 h-4 mr-2" /> Add Operator</Button>
            </DialogTrigger>
            <DialogContent className="bg-card border-border">
              <DialogHeader>
                <DialogTitle className="font-mono uppercase tracking-widest text-primary">Register Operator</DialogTitle>
              </DialogHeader>
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                  <FormField control={form.control} name="name" render={({ field }) => (
                    <FormItem><FormLabel className="font-mono text-xs uppercase text-muted-foreground">Full Name</FormLabel>
                    <FormControl><Input className="font-mono bg-background border-border" {...field} /></FormControl></FormItem>
                  )} />
                  <FormField control={form.control} name="trade" render={({ field }) => (
                    <FormItem><FormLabel className="font-mono text-xs uppercase text-muted-foreground">Trade / Role</FormLabel>
                    <FormControl><Input className="font-mono bg-background border-border" {...field} /></FormControl></FormItem>
                  )} />
                  <FormField control={form.control} name="zone" render={({ field }) => (
                    <FormItem><FormLabel className="font-mono text-xs uppercase text-muted-foreground">Assigned Zone</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl><SelectTrigger className="font-mono bg-background border-border"><SelectValue placeholder="Select Zone" /></SelectTrigger></FormControl>
                      <SelectContent>
                        {['A','B','C','D'].map(z => <SelectItem key={z} value={z}>Zone {z}</SelectItem>)}
                      </SelectContent>
                    </Select></FormItem>
                  )} />
                  <Button type="submit" className="w-full font-mono uppercase" disabled={createWorker.isPending}>Deploy Operator</Button>
                </form>
              </Form>
            </DialogContent>
          </Dialog>
        </div>

        <div className="flex flex-col md:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input 
              placeholder="SEARCH OPERATOR ID OR NAME..." 
              className="pl-9 font-mono bg-card border-border uppercase"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <div className="flex gap-2">
            <Select value={zoneFilter} onValueChange={setZoneFilter}>
              <SelectTrigger className="w-[140px] font-mono bg-card border-border"><Filter className="w-3 h-3 mr-2"/> <SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Zones</SelectItem>
                {['A','B','C','D'].map(z => <SelectItem key={z} value={z}>Zone {z}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[140px] font-mono bg-card border-border"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="break">On Break</SelectItem>
                <SelectItem value="offsite">Off Site</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="rounded-xl border border-border bg-card overflow-hidden">
          <Table>
            <TableHeader className="bg-muted/20">
              <TableRow className="border-border hover:bg-transparent">
                <TableHead className="font-mono text-[10px] uppercase text-muted-foreground tracking-widest">ID / Name</TableHead>
                <TableHead className="font-mono text-[10px] uppercase text-muted-foreground tracking-widest">Trade</TableHead>
                <TableHead className="font-mono text-[10px] uppercase text-muted-foreground tracking-widest">Zone</TableHead>
                <TableHead className="font-mono text-[10px] uppercase text-muted-foreground tracking-widest">Status</TableHead>
                <TableHead className="font-mono text-[10px] uppercase text-muted-foreground tracking-widest text-right">PPE Score</TableHead>
                <TableHead className="font-mono text-[10px] uppercase text-muted-foreground tracking-widest text-right">Fatigue</TableHead>
                <TableHead className="font-mono text-[10px] uppercase text-muted-foreground tracking-widest text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={7} className="text-center py-8 font-mono text-muted-foreground">Retrieving roster data...</TableCell></TableRow>
              ) : filteredWorkers?.map((worker) => (
                <TableRow 
                  key={worker.id} 
                  className={`border-border hover:bg-muted/10 cursor-pointer ${selectedWorker?.id === worker.id ? 'bg-primary/5 border-primary/20' : ''}`}
                  onClick={() => setSelectedWorker(worker)}
                >
                  <TableCell className="font-mono">
                    <div className="font-bold text-foreground uppercase">{worker.name}</div>
                    <div className="text-[10px] text-muted-foreground tracking-widest">OP-{worker.id.toString().padStart(4, '0')}</div>
                  </TableCell>
                  <TableCell className="font-mono text-xs uppercase">{worker.trade}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className="font-mono text-[10px] bg-background border-border text-foreground uppercase px-2 py-0">Zone {worker.zone}</Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className={`font-mono text-[9px] uppercase px-2 py-0 ${
                      worker.status === 'active' ? 'border-safe text-safe bg-safe/10' :
                      worker.status === 'break' ? 'border-warning text-warning bg-warning/10' :
                      'border-muted text-muted-foreground bg-muted/20'
                    }`}>
                      {worker.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-2 w-full">
                      <div className="w-16 h-1.5 bg-muted rounded overflow-hidden">
                        <div className={`h-full ${worker.ppeScore > 80 ? 'bg-safe' : worker.ppeScore > 50 ? 'bg-warning' : 'bg-critical'}`} style={{width: `${worker.ppeScore}%`}} />
                      </div>
                      <span className="font-mono text-xs w-8">{worker.ppeScore}%</span>
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                     <div className="flex items-center justify-end gap-2 w-full">
                      <div className="w-16 h-1.5 bg-muted rounded overflow-hidden">
                        <div className={`h-full ${worker.fatigueScore < 30 ? 'bg-safe' : worker.fatigueScore < 60 ? 'bg-warning' : 'bg-critical'}`} style={{width: `${worker.fatigueScore}%`}} />
                      </div>
                      <span className="font-mono text-xs w-8">{worker.fatigueScore}%</span>
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-primary" onClick={(e) => { e.stopPropagation(); handleSendMessage(worker.name); }}>
                      <MessageSquare className="w-4 h-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>

      {/* Slide-in Panel */}
      <div className={`fixed top-0 right-0 h-full w-80 bg-card border-l border-border shadow-2xl transform transition-transform duration-300 z-40 flex flex-col ${selectedWorker ? 'translate-x-0' : 'translate-x-full'}`}>
        {selectedWorker && (
          <>
            <div className="p-4 border-b border-border flex justify-between items-center bg-muted/10">
              <h2 className="font-mono font-bold uppercase tracking-widest text-primary">Dossier OP-{selectedWorker.id.toString().padStart(4, '0')}</h2>
              <Button variant="ghost" size="icon" onClick={() => setSelectedWorker(null)}><X className="w-4 h-4"/></Button>
            </div>
            <div className="p-6 flex-1 overflow-y-auto custom-scrollbar space-y-6">
              <div>
                <h3 className="text-2xl font-bold font-mono uppercase text-foreground">{selectedWorker.name}</h3>
                <p className="text-xs font-mono text-muted-foreground uppercase tracking-widest mt-1">{selectedWorker.trade} • Zone {selectedWorker.zone}</p>
              </div>

              <div className="space-y-3">
                <div className="flex justify-between items-center py-2 border-b border-border/50">
                  <span className="font-mono text-[10px] text-muted-foreground uppercase tracking-widest">Status</span>
                  <Badge variant="outline" className="font-mono text-[10px] uppercase border-safe text-safe bg-safe/10">{selectedWorker.status}</Badge>
                </div>
                <div className="flex justify-between items-center py-2 border-b border-border/50">
                  <span className="font-mono text-[10px] text-muted-foreground uppercase tracking-widest">Shift Start</span>
                  <span className="font-mono text-xs">{selectedWorker.shiftStart ? new Date(selectedWorker.shiftStart).toLocaleTimeString() : 'N/A'}</span>
                </div>
              </div>

              <div>
                <h4 className="font-mono text-xs uppercase tracking-widest text-muted-foreground mb-3">Metrics</h4>
                <div className="space-y-4">
                  <div>
                    <div className="flex justify-between mb-1 font-mono text-xs"><span className="uppercase">PPE Compliance</span><span>{selectedWorker.ppeScore}%</span></div>
                    <div className="h-2 w-full bg-muted rounded overflow-hidden"><div className="h-full bg-safe" style={{width: `${selectedWorker.ppeScore}%`}}/></div>
                  </div>
                  <div>
                    <div className="flex justify-between mb-1 font-mono text-xs"><span className="uppercase">Fatigue Index</span><span>{selectedWorker.fatigueScore}%</span></div>
                    <div className="h-2 w-full bg-muted rounded overflow-hidden"><div className="h-full bg-warning" style={{width: `${selectedWorker.fatigueScore}%`}}/></div>
                  </div>
                </div>
              </div>

              <div>
                <h4 className="font-mono text-xs uppercase tracking-widest text-muted-foreground mb-3">Certifications ({selectedWorker.certifications?.length || 0})</h4>
                <div className="flex flex-wrap gap-2">
                  {selectedWorker.certifications?.map((cert: string) => (
                    <Badge key={cert} variant="outline" className="font-mono text-[9px] uppercase border-border text-foreground bg-background">{cert}</Badge>
                  ))}
                  {!selectedWorker.certifications?.length && <span className="font-mono text-xs text-muted-foreground">None registered</span>}
                </div>
              </div>
            </div>
            <div className="p-4 border-t border-border bg-muted/10 flex flex-col gap-2">
               <Button className="w-full font-mono uppercase bg-primary hover:bg-primary/90" onClick={() => handleSendMessage(selectedWorker.name)}>
                 <MessageSquare className="w-4 h-4 mr-2" /> Direct Message
               </Button>
               <Button variant="outline" className="w-full font-mono uppercase text-critical border-critical/30 hover:bg-critical/10" onClick={() => handleMarkRisk(selectedWorker.id, selectedWorker.zone)}>
                 <AlertTriangle className="w-4 h-4 mr-2" /> Flag Risk
               </Button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
