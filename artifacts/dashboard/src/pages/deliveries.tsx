import { useState } from "react";
import { useListDeliveries, useCreateDelivery, useUpdateDelivery, getListDeliveriesQueryKey } from "@workspace/api-client-react";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { Badge } from "@/components/ui/badge";

const deliverySchema = z.object({
  materialType: z.string().min(2),
  quantity: z.coerce.number().min(1),
  gate: z.string().min(1),
  eta: z.string().optional(),
});

export default function Deliveries() {
  const queryClient = useQueryClient();
  const { data: deliveries, isLoading } = useListDeliveries();
  const createMutation = useCreateDelivery();
  const updateMutation = useUpdateDelivery();
  const [open, setOpen] = useState(false);

  const form = useForm<z.infer<typeof deliverySchema>>({
    resolver: zodResolver(deliverySchema),
    defaultValues: {
      materialType: "",
      quantity: 1,
      gate: "Gate 1",
    },
  });

  const onSubmit = (values: z.infer<typeof deliverySchema>) => {
    createMutation.mutate({ data: { ...values, status: 'scheduled' } }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListDeliveriesQueryKey() });
        setOpen(false);
        form.reset();
      }
    });
  };

  const handleStatusUpdate = (id: number, newStatus: string) => {
    updateMutation.mutate({
      id,
      data: { status: newStatus }
    }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListDeliveriesQueryKey() });
      }
    });
  };

  if (isLoading) return <div className="p-8">LOADING DELIVERIES...</div>;

  return (
    <div className="p-8 space-y-6">
      <div className="flex justify-between items-end">
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-foreground">DELIVERY TRACKER</h2>
          <p className="text-muted-foreground uppercase tracking-widest text-xs mt-1">Logistics & Supply</p>
        </div>
        
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button>SCHEDULE DELIVERY</Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[425px] font-mono">
            <DialogHeader>
              <DialogTitle className="uppercase tracking-wider">Schedule Delivery</DialogTitle>
            </DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="materialType"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>MATERIAL TYPE</FormLabel>
                      <FormControl>
                        <Input placeholder="E.g., Concrete, Steel" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="quantity"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>QUANTITY</FormLabel>
                      <FormControl>
                        <Input type="number" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="gate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>GATE</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="Gate 1">Gate 1 (North)</SelectItem>
                          <SelectItem value="Gate 2">Gate 2 (East)</SelectItem>
                          <SelectItem value="Gate 3">Gate 3 (South)</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="eta"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>ETA (Optional)</FormLabel>
                      <FormControl>
                        <Input type="datetime-local" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <div className="flex justify-end pt-4">
                  <Button type="submit" disabled={createMutation.isPending}>
                    {createMutation.isPending ? "SCHEDULING..." : "SCHEDULE"}
                  </Button>
                </div>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>

      <Card className="bg-card border-border">
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="border-border hover:bg-transparent">
                <TableHead className="font-bold text-muted-foreground uppercase tracking-wider">ID</TableHead>
                <TableHead className="font-bold text-muted-foreground uppercase tracking-wider">Material</TableHead>
                <TableHead className="font-bold text-muted-foreground uppercase tracking-wider">Qty</TableHead>
                <TableHead className="font-bold text-muted-foreground uppercase tracking-wider">Gate</TableHead>
                <TableHead className="font-bold text-muted-foreground uppercase tracking-wider">ETA</TableHead>
                <TableHead className="font-bold text-muted-foreground uppercase tracking-wider">Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {deliveries?.map((delivery) => (
                <TableRow key={delivery.id} className="border-border">
                  <TableCell className="font-mono text-muted-foreground text-xs">#{delivery.id}</TableCell>
                  <TableCell className="font-medium uppercase text-xs">{delivery.materialType}</TableCell>
                  <TableCell className="font-mono">{delivery.quantity}</TableCell>
                  <TableCell>{delivery.gate}</TableCell>
                  <TableCell className="text-xs text-muted-foreground font-mono">
                    {delivery.eta ? new Date(delivery.eta).toLocaleString() : 'TBD'}
                  </TableCell>
                  <TableCell>
                    <Select 
                      defaultValue={delivery.status} 
                      onValueChange={(val) => handleStatusUpdate(delivery.id, val)}
                    >
                      <SelectTrigger className={`w-32 h-8 text-xs font-mono font-bold uppercase ${
                        delivery.status === 'arrived' ? 'text-primary' :
                        delivery.status === 'unloaded' ? 'text-muted-foreground' : ''
                      }`}>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="scheduled">Scheduled</SelectItem>
                        <SelectItem value="in_transit">In Transit</SelectItem>
                        <SelectItem value="arrived">Arrived</SelectItem>
                        <SelectItem value="unloaded">Unloaded</SelectItem>
                      </SelectContent>
                    </Select>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}