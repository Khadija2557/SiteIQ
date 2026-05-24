import { useState } from "react";
import { useAiOptimizeSchedule, useGetAiDecisions, useAiHandleDisruption, useAiPlanRoute, getGetAiDecisionsQueryKey } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { BrainCircuit, Route, AlertTriangle, FastForward } from "lucide-react";

const disruptionSchema = z.object({
  type: z.string().min(1),
  entity_id: z.coerce.number().min(1),
});

const routeSchema = z.object({
  startX: z.coerce.number(),
  startY: z.coerce.number(),
  endX: z.coerce.number(),
  endY: z.coerce.number(),
});

export default function AiOperations() {
  const queryClient = useQueryClient();
  const { data: decisions, refetch: refetchDecisions } = useGetAiDecisions({ limit: 10 });
  const optimizeMutation = useAiOptimizeSchedule();
  const disruptionMutation = useAiHandleDisruption();
  const routeMutation = useAiPlanRoute();

  const disruptionForm = useForm<z.infer<typeof disruptionSchema>>({
    resolver: zodResolver(disruptionSchema),
    defaultValues: { type: "worker_absence", entity_id: 1 },
  });

  const routeForm = useForm<z.infer<typeof routeSchema>>({
    resolver: zodResolver(routeSchema),
    defaultValues: { startX: 0, startY: 0, endX: 100, endY: 100 },
  });

  const handleOptimize = () => {
    optimizeMutation.mutate({ data: { apply: true } }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetAiDecisionsQueryKey() });
      }
    });
  };

  const onDisruptionSubmit = (values: z.infer<typeof disruptionSchema>) => {
    disruptionMutation.mutate({ data: values }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetAiDecisionsQueryKey() });
      }
    });
  };

  const onRouteSubmit = (values: z.infer<typeof routeSchema>) => {
    routeMutation.mutate({ data: values });
  };

  return (
    <div className="p-8 space-y-6">
      <div className="flex justify-between items-end">
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-foreground">AI OPERATIONS</h2>
          <p className="text-muted-foreground uppercase tracking-widest text-xs mt-1">Autonomous Systems</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="bg-card border-border md:col-span-2">
          <CardHeader>
            <CardTitle className="text-sm font-bold uppercase tracking-wider flex items-center gap-2">
              <BrainCircuit className="h-4 w-4" /> AI Decisions Log
            </CardTitle>
            <CardDescription>Recent autonomous actions</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {decisions?.decisions.map((decision) => (
                <div key={decision.id} className="border border-border p-4 rounded-sm bg-background">
                  <div className="flex justify-between items-start mb-2">
                    <span className="font-bold text-primary uppercase text-xs tracking-wider">{decision.type.replace('_', ' ')}</span>
                    <span className="text-muted-foreground text-[10px] font-mono">{new Date(decision.timestamp).toLocaleString()}</span>
                  </div>
                  <p className="text-sm leading-relaxed">{decision.explanation}</p>
                </div>
              ))}
              {decisions?.decisions.length === 0 && (
                <div className="text-center py-8 text-muted-foreground uppercase tracking-widest text-sm">
                  No Recent Decisions
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card className="bg-card border-border">
            <CardHeader>
              <CardTitle className="text-sm font-bold uppercase tracking-wider flex items-center gap-2">
                <FastForward className="h-4 w-4" /> Schedule Optimizer
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-xs text-muted-foreground mb-4">Run full site schedule optimization. Assigns tasks, resolves conflicts.</p>
              <Button 
                onClick={handleOptimize} 
                className="w-full" 
                disabled={optimizeMutation.isPending}
              >
                {optimizeMutation.isPending ? "OPTIMIZING..." : "RUN OPTIMIZER"}
              </Button>
            </CardContent>
          </Card>

          <Card className="bg-card border-border">
            <CardHeader>
              <CardTitle className="text-sm font-bold uppercase tracking-wider flex items-center gap-2 text-amber-500">
                <AlertTriangle className="h-4 w-4" /> Disruption Handler
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Form {...disruptionForm}>
                <form onSubmit={disruptionForm.handleSubmit(onDisruptionSubmit)} className="space-y-4">
                  <FormField
                    control={disruptionForm.control}
                    name="type"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-xs">DISRUPTION TYPE</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger className="h-8 text-xs">
                              <SelectValue />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="worker_absence">Worker Absence</SelectItem>
                            <SelectItem value="machine_breakdown">Machine Breakdown</SelectItem>
                            <SelectItem value="weather_event">Weather Event</SelectItem>
                          </SelectContent>
                        </Select>
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={disruptionForm.control}
                    name="entity_id"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-xs">ENTITY ID</FormLabel>
                        <FormControl>
                          <Input type="number" className="h-8 text-xs" {...field} />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                  <Button type="submit" variant="outline" className="w-full h-8 text-xs" disabled={disruptionMutation.isPending}>
                    {disruptionMutation.isPending ? "HANDLING..." : "HANDLE DISRUPTION"}
                  </Button>
                </form>
              </Form>
            </CardContent>
          </Card>

          <Card className="bg-card border-border">
            <CardHeader>
              <CardTitle className="text-sm font-bold uppercase tracking-wider flex items-center gap-2">
                <Route className="h-4 w-4" /> Route Planner
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Form {...routeForm}>
                <form onSubmit={routeForm.handleSubmit(onRouteSubmit)} className="space-y-4">
                  <div className="grid grid-cols-2 gap-2">
                    <FormField
                      control={routeForm.control}
                      name="startX"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-[10px]">START X</FormLabel>
                          <FormControl><Input type="number" className="h-8 text-xs" {...field} /></FormControl>
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={routeForm.control}
                      name="startY"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-[10px]">START Y</FormLabel>
                          <FormControl><Input type="number" className="h-8 text-xs" {...field} /></FormControl>
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={routeForm.control}
                      name="endX"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-[10px]">END X</FormLabel>
                          <FormControl><Input type="number" className="h-8 text-xs" {...field} /></FormControl>
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={routeForm.control}
                      name="endY"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-[10px]">END Y</FormLabel>
                          <FormControl><Input type="number" className="h-8 text-xs" {...field} /></FormControl>
                        </FormItem>
                      )}
                    />
                  </div>
                  <Button type="submit" variant="outline" className="w-full h-8 text-xs" disabled={routeMutation.isPending}>
                    {routeMutation.isPending ? "PLANNING..." : "PLAN ROUTE"}
                  </Button>
                </form>
              </Form>
              {routeMutation.isSuccess && routeMutation.data && (
                <div className="mt-4 p-3 bg-primary/10 border border-primary/20 rounded text-xs">
                  <p className="font-bold text-primary mb-1">Route Planned</p>
                  <p>Safe: {routeMutation.data.safe ? "YES" : "NO"}</p>
                  <p>Est. Distance: {routeMutation.data.estimatedDistance?.toFixed(1)}m</p>
                  <p>Waypoints: {routeMutation.data.waypointCount}</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}