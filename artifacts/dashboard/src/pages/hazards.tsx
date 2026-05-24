import { useState } from "react";
import { useListHazards, useCreateHazard, useResolveHazard, getListHazardsQueryKey } from "@workspace/api-client-react";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { Badge } from "@/components/ui/badge";

const hazardSchema = z.object({
  type: z.string().min(1),
  severity: z.string().min(1),
  zone: z.string().min(1),
  description: z.string().optional(),
});

export default function Hazards() {
  const queryClient = useQueryClient();
  const { data: hazards, isLoading } = useListHazards({ active: true });
  const resolveMutation = useResolveHazard();
  const createMutation = useCreateHazard();
  const [open, setOpen] = useState(false);

  const form = useForm<z.infer<typeof hazardSchema>>({
    resolver: zodResolver(hazardSchema),
    defaultValues: {
      type: "electrical",
      severity: "medium",
      zone: "Zone A",
      description: "",
    },
  });

  const handleResolve = (id: number) => {
    resolveMutation.mutate({ id }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListHazardsQueryKey() });
      }
    });
  };

  const onSubmit = (values: z.infer<typeof hazardSchema>) => {
    createMutation.mutate({ data: values }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListHazardsQueryKey() });
        setOpen(false);
        form.reset();
      }
    });
  };

  if (isLoading) return <div className="p-8">LOADING HAZARDS...</div>;

  return (
    <div className="p-8 space-y-6">
      <div className="flex justify-between items-end">
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-foreground">HAZARD MAP</h2>
          <p className="text-muted-foreground uppercase tracking-widest text-xs mt-1">Safety Incidents</p>
        </div>
        
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button variant="destructive">REPORT HAZARD</Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[425px] font-mono">
            <DialogHeader>
              <DialogTitle className="uppercase tracking-wider text-destructive">Report Safety Hazard</DialogTitle>
            </DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="type"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>TYPE</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="fire">Fire</SelectItem>
                          <SelectItem value="electrical">Electrical</SelectItem>
                          <SelectItem value="structural">Structural</SelectItem>
                          <SelectItem value="chemical">Chemical</SelectItem>
                          <SelectItem value="fall">Fall</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="severity"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>SEVERITY</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="low">Low</SelectItem>
                          <SelectItem value="medium">Medium</SelectItem>
                          <SelectItem value="high">High</SelectItem>
                          <SelectItem value="critical">Critical</SelectItem>
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
                            <SelectValue />
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
                  name="description"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>DESCRIPTION</FormLabel>
                      <FormControl>
                        <Input placeholder="Details..." {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <div className="flex justify-end pt-4">
                  <Button type="submit" variant="destructive" disabled={createMutation.isPending}>
                    {createMutation.isPending ? "REPORTING..." : "CONFIRM"}
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
                <TableHead className="font-bold text-muted-foreground uppercase tracking-wider">Type</TableHead>
                <TableHead className="font-bold text-muted-foreground uppercase tracking-wider">Zone</TableHead>
                <TableHead className="font-bold text-muted-foreground uppercase tracking-wider">Severity</TableHead>
                <TableHead className="font-bold text-muted-foreground uppercase tracking-wider">Detected</TableHead>
                <TableHead className="font-bold text-muted-foreground uppercase tracking-wider text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {hazards?.map((hazard) => (
                <TableRow key={hazard.id} className="border-border">
                  <TableCell className="font-mono text-muted-foreground text-xs">#{hazard.id}</TableCell>
                  <TableCell className="uppercase text-xs font-bold">{hazard.type}</TableCell>
                  <TableCell>{hazard.zone}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className={`uppercase text-[10px] rounded-sm ${
                      hazard.severity === 'critical' ? 'border-destructive text-destructive bg-destructive/10' :
                      hazard.severity === 'high' ? 'border-amber-500 text-amber-500 bg-amber-500/10' :
                      'border-primary text-primary bg-primary/10'
                    }`}>
                      {hazard.severity}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {new Date(hazard.detectedAt).toLocaleString()}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button 
                      variant="outline" 
                      size="sm" 
                      className="h-8 text-xs font-bold uppercase tracking-wider"
                      onClick={() => handleResolve(hazard.id)}
                      disabled={resolveMutation.isPending}
                    >
                      RESOLVE
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
              {hazards?.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-muted-foreground uppercase tracking-widest text-sm">
                    No Active Hazards
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}