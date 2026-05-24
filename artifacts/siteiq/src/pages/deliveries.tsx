import { useState } from "react";
import { useListDeliveries, useCreateDelivery, useUpdateDelivery, getListDeliveriesQueryKey } from "@workspace/api-client-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel } from "@/components/ui/form";
import { Package, Clock, Filter, Plus, ArrowRight } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useToast } from "@/hooks/use-toast";

const deliverySchema = z.object({
  materialType: z.string().min(2),
  quantity: z.coerce.number().min(1),
  gate: z.string().min(1),
  eta: z.string().optional(),
});

export default function Deliveries() {
  const [statusFilter, setStatusFilter] = useState("all");
  const [isAddOpen, setIsAddOpen] = useState(false);

  const { data: deliveries, isLoading } = useListDeliveries({
    status: statusFilter !== 'all' ? statusFilter : undefined
  });
  
  const createDelivery = useCreateDelivery();
  const updateDelivery = useUpdateDelivery();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const form = useForm<z.infer<typeof deliverySchema>>({
    resolver: zodResolver(deliverySchema),
    defaultValues: { materialType: "", quantity: 1, gate: "A", eta: "" }
  });

  const onSubmit = (data: z.infer<typeof deliverySchema>) => {
    createDelivery.mutate({ data }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListDeliveriesQueryKey() });
        setIsAddOpen(false);
        form.reset();
        toast({ title: "Manifest Updated", description: "Inbound payload logged." });
      }
    });
  };

  const handleUpdateStatus = (id: number, currentStatus: string) => {
    let next = 'pending';
    if(currentStatus === 'pending') next = 'in-transit';
    if(currentStatus === 'in-transit') next = 'arrived';
    if(next !== currentStatus) {
      updateDelivery.mutate({ id, data: { status: next } }, {
        onSuccess: () => queryClient.invalidateQueries({ queryKey: getListDeliveriesQueryKey() })
      });
    }
  };

  return (
    <div className="space-y-6 fade-in-up">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-mono font-bold tracking-tight text-foreground uppercase flex items-center gap-3">
            <Package className="w-8 h-8 text-primary" /> Logistics
          </h1>
          <p className="text-sm font-mono text-muted-foreground mt-1 uppercase tracking-widest">Inbound Material Manifest</p>
        </div>

        <div className="flex gap-3">
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[140px] font-mono bg-card border-border"><Filter className="w-3 h-3 mr-2"/> <SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All States</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="in-transit">In Transit</SelectItem>
              <SelectItem value="arrived">Arrived</SelectItem>
            </SelectContent>
          </Select>
          
          <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
            <DialogTrigger asChild>
              <Button className="font-mono uppercase tracking-wider"><Plus className="w-4 h-4 mr-2" /> Schedule Drop</Button>
            </DialogTrigger>
            <DialogContent className="bg-card border-border">
              <DialogHeader><DialogTitle className="font-mono uppercase tracking-widest text-primary">Inbound Registration</DialogTitle></DialogHeader>
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                  <FormField control={form.control} name="materialType" render={({ field }) => (
                    <FormItem><FormLabel className="font-mono text-xs uppercase">Payload Type</FormLabel><FormControl><Input className="font-mono bg-background border-border" {...field} /></FormControl></FormItem>
                  )} />
                  <div className="grid grid-cols-2 gap-4">
                    <FormField control={form.control} name="quantity" render={({ field }) => (
                      <FormItem><FormLabel className="font-mono text-xs uppercase">Tonnage/Qty</FormLabel><FormControl><Input type="number" className="font-mono bg-background border-border" {...field} /></FormControl></FormItem>
                    )} />
                    <FormField control={form.control} name="gate" render={({ field }) => (
                      <FormItem><FormLabel className="font-mono text-xs uppercase">Access Point</FormLabel><Select onValueChange={field.onChange} defaultValue={field.value}><FormControl><SelectTrigger className="font-mono bg-background border-border"><SelectValue /></SelectTrigger></FormControl><SelectContent>{['A','B','C','D'].map(g => <SelectItem key={g} value={`Gate ${g}`}>Gate {g}</SelectItem>)}</SelectContent></Select></FormItem>
                    )} />
                  </div>
                  <FormField control={form.control} name="eta" render={({ field }) => (
                    <FormItem><FormLabel className="font-mono text-xs uppercase">ETA</FormLabel><FormControl><Input type="datetime-local" className="font-mono bg-background border-border" {...field} /></FormControl></FormItem>
                  )} />
                  <Button type="submit" className="w-full font-mono uppercase" disabled={createDelivery.isPending}>Lock In Schedule</Button>
                </form>
              </Form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <div className="rounded-sm border border-border bg-card overflow-hidden shadow-sm">
        <Table>
          <TableHeader className="bg-muted/20">
            <TableRow className="border-border hover:bg-transparent">
              <TableHead className="font-mono text-[10px] uppercase text-muted-foreground tracking-widest">Manifest ID</TableHead>
              <TableHead className="font-mono text-[10px] uppercase text-muted-foreground tracking-widest">Payload</TableHead>
              <TableHead className="font-mono text-[10px] uppercase text-muted-foreground tracking-widest">Access Point</TableHead>
              <TableHead className="font-mono text-[10px] uppercase text-muted-foreground tracking-widest">Status</TableHead>
              <TableHead className="font-mono text-[10px] uppercase text-muted-foreground tracking-widest text-right">ETA</TableHead>
              <TableHead className="font-mono text-[10px] uppercase text-muted-foreground tracking-widest text-right">Action</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={6} className="text-center py-8 font-mono text-muted-foreground">Parsing manifest data...</TableCell></TableRow>
            ) : deliveries?.map((delivery) => (
              <TableRow key={delivery.id} className="border-border hover:bg-muted/10">
                <TableCell className="font-mono text-muted-foreground text-[10px] tracking-widest">
                  SHP-{delivery.id.toString().padStart(4, '0')}
                </TableCell>
                <TableCell className="font-mono">
                  <div className="font-bold text-foreground uppercase text-xs">{delivery.materialType}</div>
                  <div className="text-[10px] text-primary tracking-widest">VOL: {delivery.quantity}</div>
                </TableCell>
                <TableCell className="font-mono text-[10px] uppercase text-muted-foreground">
                  <span className="border border-border bg-background px-2 py-0.5 rounded">{delivery.gate}</span>
                </TableCell>
                <TableCell>
                  <Badge variant="outline" className={`font-mono text-[9px] uppercase px-1.5 py-0 ${
                    delivery.status === 'arrived' ? 'border-safe text-safe bg-safe/10' :
                    delivery.status === 'delayed' ? 'border-critical text-critical bg-critical/10' :
                    delivery.status === 'in-transit' ? 'border-warning text-warning bg-warning/10' :
                    'border-info text-info bg-info/10'
                  }`}>
                    {delivery.status}
                  </Badge>
                </TableCell>
                <TableCell className="text-right font-mono text-[10px] tracking-wider text-muted-foreground">
                  {delivery.eta ? (
                    <span>{new Date(delivery.eta).toLocaleString(undefined, {month:'short', day:'numeric', hour:'2-digit', minute:'2-digit'})}</span>
                  ) : 'TBD'}
                </TableCell>
                <TableCell className="text-right">
                  {delivery.status !== 'arrived' && (
                    <Button 
                      size="sm" 
                      variant="outline" 
                      className="font-mono text-[9px] h-7 uppercase border-primary/30 text-primary hover:bg-primary/10 hover:text-primary"
                      onClick={() => handleUpdateStatus(delivery.id, delivery.status)}
                    >
                      Step <ArrowRight className="w-3 h-3 ml-1" />
                    </Button>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
