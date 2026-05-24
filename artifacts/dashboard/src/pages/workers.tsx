import { useState } from "react";
import { useListWorkers, useCreateWorker } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { getListWorkersQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";

const workerSchema = z.object({
  name: z.string().min(2),
  trade: z.string().min(2),
  zone: z.string().min(1),
  status: z.string().min(1),
});

export default function Workers() {
  const [filterZone, setFilterZone] = useState<string>("all");
  const queryClient = useQueryClient();
  
  const { data: workers, isLoading } = useListWorkers(
    filterZone !== "all" ? { zone: filterZone } : {}
  );
  const createWorkerMutation = useCreateWorker();
  const [open, setOpen] = useState(false);

  const form = useForm<z.infer<typeof workerSchema>>({
    resolver: zodResolver(workerSchema),
    defaultValues: {
      name: "",
      trade: "laborer",
      zone: "Zone A",
      status: "active",
    },
  });

  const onSubmit = (values: z.infer<typeof workerSchema>) => {
    createWorkerMutation.mutate({
      data: {
        name: values.name,
        trade: values.trade,
        zone: values.zone,
        status: values.status,
      }
    }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListWorkersQueryKey() });
        setOpen(false);
        form.reset();
      }
    });
  };

  if (isLoading) return <div className="p-8">LOADING WORKERS...</div>;

  return (
    <div className="p-8 space-y-6">
      <div className="flex justify-between items-end">
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-foreground">WORKER ROSTER</h2>
          <p className="text-muted-foreground uppercase tracking-widest text-xs mt-1">Personnel Tracking</p>
        </div>
        
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button>ADD PERSONNEL</Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[425px] font-mono">
            <DialogHeader>
              <DialogTitle className="uppercase tracking-wider">Add Worker</DialogTitle>
            </DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>NAME</FormLabel>
                      <FormControl>
                        <Input placeholder="John Doe" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="trade"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>TRADE</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select trade" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="electrician">Electrician</SelectItem>
                          <SelectItem value="plumber">Plumber</SelectItem>
                          <SelectItem value="welder">Welder</SelectItem>
                          <SelectItem value="carpenter">Carpenter</SelectItem>
                          <SelectItem value="laborer">Laborer</SelectItem>
                          <SelectItem value="crane_operator">Crane Operator</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="zone"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>ZONE</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select zone" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="Zone A">Zone A</SelectItem>
                          <SelectItem value="Zone B">Zone B</SelectItem>
                          <SelectItem value="Zone C">Zone C</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="status"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>STATUS</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select status" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="active">Active</SelectItem>
                          <SelectItem value="break">Break</SelectItem>
                          <SelectItem value="offsite">Offsite</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <div className="flex justify-end pt-4">
                  <Button type="submit" disabled={createWorkerMutation.isPending}>
                    {createWorkerMutation.isPending ? "SAVING..." : "SAVE"}
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
                <TableHead className="font-bold text-muted-foreground uppercase tracking-wider">Name</TableHead>
                <TableHead className="font-bold text-muted-foreground uppercase tracking-wider">Trade</TableHead>
                <TableHead className="font-bold text-muted-foreground uppercase tracking-wider">Zone</TableHead>
                <TableHead className="font-bold text-muted-foreground uppercase tracking-wider">Status</TableHead>
                <TableHead className="font-bold text-muted-foreground uppercase tracking-wider text-right">PPE Score</TableHead>
                <TableHead className="font-bold text-muted-foreground uppercase tracking-wider text-right">Fatigue</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {workers?.map((worker) => (
                <TableRow key={worker.id} className="border-border">
                  <TableCell className="font-mono text-muted-foreground text-xs">#{worker.id}</TableCell>
                  <TableCell className="font-medium">{worker.name}</TableCell>
                  <TableCell className="uppercase text-xs">{worker.trade.replace('_', ' ')}</TableCell>
                  <TableCell>{worker.zone}</TableCell>
                  <TableCell>
                    <span className={`px-2 py-1 rounded text-xs font-bold uppercase ${
                      worker.status === 'active' ? 'bg-primary/10 text-primary' : 
                      worker.status === 'break' ? 'bg-amber-500/10 text-amber-500' : 'bg-muted text-muted-foreground'
                    }`}>
                      {worker.status}
                    </span>
                  </TableCell>
                  <TableCell className="text-right">
                    <span className={worker.ppeScore < 80 ? "text-destructive font-bold" : ""}>{worker.ppeScore}%</span>
                  </TableCell>
                  <TableCell className="text-right">
                    <span className={worker.fatigueScore > 70 ? "text-amber-500 font-bold" : ""}>{worker.fatigueScore}%</span>
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