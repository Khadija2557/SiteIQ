import { useState } from "react";
import { useListTasks, useCreateTask, useUpdateTask, useReassignTask, getListTasksQueryKey } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CheckSquare, Clock, Filter, Plus, User, Cpu } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";

const taskSchema = z.object({
  title: z.string().min(2),
  description: z.string().optional(),
  zone: z.string().min(1),
  priority: z.string().min(1),
  estimatedMinutes: z.coerce.number().optional(),
});

export default function Tasks() {
  const { data: tasks, isLoading } = useListTasks();
  const [zoneFilter, setZoneFilter] = useState("all");
  const [priorityFilter, setPriorityFilter] = useState("all");
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [aiModalOpen, setAiModalOpen] = useState(false);
  const [aiReasoning, setAiReasoning] = useState("");

  const queryClient = useQueryClient();
  const { toast } = useToast();
  
  const createTask = useCreateTask();
  const updateTask = useUpdateTask();
  const reassignTask = useReassignTask();

  const form = useForm<z.infer<typeof taskSchema>>({
    resolver: zodResolver(taskSchema),
    defaultValues: { title: "", description: "", zone: "", priority: "medium", estimatedMinutes: 60 }
  });

  const onSubmit = (data: z.infer<typeof taskSchema>) => {
    createTask.mutate({ data }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListTasksQueryKey() });
        setIsAddOpen(false);
        form.reset();
        toast({ title: "Task Registered", description: "Objective added to queue." });
      }
    });
  };

  const handleDragStart = (e: React.DragEvent, id: number) => {
    e.dataTransfer.setData("taskId", id.toString());
  };

  const handleDrop = (e: React.DragEvent, status: string) => {
    e.preventDefault();
    const id = parseInt(e.dataTransfer.getData("taskId"));
    if (id) {
      updateTask.mutate({ id, data: { status } }, {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListTasksQueryKey() });
        }
      });
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleAIReassign = (id: number) => {
    reassignTask.mutate({ id }, {
      onSuccess: (res) => {
        setAiReasoning(res.aiReasoning);
        setAiModalOpen(true);
        queryClient.invalidateQueries({ queryKey: getListTasksQueryKey() });
      }
    });
  };

  const getPriorityColor = (priority: string) => {
    switch(priority) {
      case 'critical': return 'border-critical text-critical bg-critical/10';
      case 'high': return 'border-warning text-warning bg-warning/10';
      case 'medium': return 'border-info text-info bg-info/10';
      default: return 'border-muted text-muted-foreground bg-muted/20';
    }
  };

  const filteredTasks = tasks?.filter(t => 
    (zoneFilter === 'all' || t.zone === zoneFilter) &&
    (priorityFilter === 'all' || t.priority === priorityFilter)
  );

  const columns = ['todo', 'in_progress', 'blocked', 'complete'];

  return (
    <div className="space-y-6 h-full flex flex-col">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-mono font-bold tracking-tight text-foreground uppercase flex items-center gap-3">
            <CheckSquare className="w-8 h-8 text-primary" /> Task Board
          </h1>
          <p className="text-sm font-mono text-muted-foreground mt-1 uppercase tracking-widest">Active Operations</p>
        </div>

        <div className="flex items-center gap-3">
          <Select value={zoneFilter} onValueChange={setZoneFilter}>
            <SelectTrigger className="w-[120px] font-mono bg-card border-border"><Filter className="w-3 h-3 mr-2"/> <SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Zones</SelectItem>
              {['A','B','C','D'].map(z => <SelectItem key={z} value={z}>Zone {z}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={priorityFilter} onValueChange={setPriorityFilter}>
            <SelectTrigger className="w-[140px] font-mono bg-card border-border"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Priorities</SelectItem>
              <SelectItem value="critical">Critical</SelectItem>
              <SelectItem value="high">High</SelectItem>
              <SelectItem value="medium">Medium</SelectItem>
              <SelectItem value="low">Low</SelectItem>
            </SelectContent>
          </Select>
          <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
            <DialogTrigger asChild>
              <Button className="font-mono uppercase tracking-wider"><Plus className="w-4 h-4 mr-2" /> New Task</Button>
            </DialogTrigger>
            <DialogContent className="bg-card border-border">
              <DialogHeader><DialogTitle className="font-mono uppercase tracking-widest text-primary">Deploy Objective</DialogTitle></DialogHeader>
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                  <FormField control={form.control} name="title" render={({ field }) => (
                    <FormItem><FormLabel className="font-mono text-xs uppercase">Objective Title</FormLabel><FormControl><Input className="font-mono bg-background border-border" {...field} /></FormControl></FormItem>
                  )} />
                  <FormField control={form.control} name="description" render={({ field }) => (
                    <FormItem><FormLabel className="font-mono text-xs uppercase">Parameters</FormLabel><FormControl><Input className="font-mono bg-background border-border" {...field} /></FormControl></FormItem>
                  )} />
                  <div className="grid grid-cols-2 gap-4">
                    <FormField control={form.control} name="zone" render={({ field }) => (
                      <FormItem><FormLabel className="font-mono text-xs uppercase">Zone</FormLabel><Select onValueChange={field.onChange} defaultValue={field.value}><FormControl><SelectTrigger className="font-mono bg-background border-border"><SelectValue placeholder="Select" /></SelectTrigger></FormControl><SelectContent>{['A','B','C','D'].map(z => <SelectItem key={z} value={z}>Zone {z}</SelectItem>)}</SelectContent></Select></FormItem>
                    )} />
                    <FormField control={form.control} name="priority" render={({ field }) => (
                      <FormItem><FormLabel className="font-mono text-xs uppercase">Priority</FormLabel><Select onValueChange={field.onChange} defaultValue={field.value}><FormControl><SelectTrigger className="font-mono bg-background border-border"><SelectValue /></SelectTrigger></FormControl><SelectContent><SelectItem value="critical">Critical</SelectItem><SelectItem value="high">High</SelectItem><SelectItem value="medium">Medium</SelectItem><SelectItem value="low">Low</SelectItem></SelectContent></Select></FormItem>
                    )} />
                  </div>
                  <FormField control={form.control} name="estimatedMinutes" render={({ field }) => (
                    <FormItem><FormLabel className="font-mono text-xs uppercase">Est. Duration (min)</FormLabel><FormControl><Input type="number" className="font-mono bg-background border-border" {...field} /></FormControl></FormItem>
                  )} />
                  <Button type="submit" className="w-full font-mono uppercase" disabled={createTask.isPending}>Register Task</Button>
                </form>
              </Form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <div className="flex-1 grid grid-cols-1 lg:grid-cols-4 gap-6 min-h-0 overflow-hidden">
        {columns.map((status) => {
          const columnTasks = filteredTasks?.filter(t => t.status === status) || [];
          return (
            <div 
              key={status} 
              className="flex flex-col bg-muted/10 rounded-xl border border-border p-3 overflow-hidden"
              onDrop={(e) => handleDrop(e, status)}
              onDragOver={handleDragOver}
            >
              <div className="font-mono text-xs uppercase tracking-widest text-muted-foreground border-b border-border/50 pb-2 mb-3 flex justify-between items-center shrink-0">
                {status.replace('_', ' ')}
                <span className="bg-background border border-border px-2 py-0.5 rounded text-[10px] text-foreground">{columnTasks.length}</span>
              </div>
              
              <div className="flex-1 overflow-y-auto custom-scrollbar space-y-3 pr-1">
                {isLoading ? (
                  <div className="h-24 bg-card/40 rounded border border-border animate-pulse" />
                ) : columnTasks.map((task) => (
                  <div 
                    key={task.id} 
                    draggable
                    onDragStart={(e) => handleDragStart(e, task.id)}
                    className="cursor-move"
                  >
                    <Card className="bg-card border-border hover:border-primary/50 transition-colors shadow-sm relative overflow-hidden group">
                      {task.priority === 'critical' && <div className="absolute top-0 left-0 w-1 h-full bg-critical" />}
                      <CardHeader className="p-3 pb-1">
                        <div className="flex justify-between items-start gap-2">
                          <CardTitle className="text-xs font-mono font-bold leading-tight uppercase">{task.title}</CardTitle>
                          <Badge variant="outline" className={`font-mono text-[9px] uppercase px-1.5 py-0 shrink-0 ${getPriorityColor(task.priority)}`}>
                            {task.priority}
                          </Badge>
                        </div>
                      </CardHeader>
                      <CardContent className="p-3 pt-2">
                        {task.description && <p className="text-[10px] text-muted-foreground mb-3 line-clamp-2">{task.description}</p>}
                        <div className="flex justify-between items-center text-[9px] font-mono text-muted-foreground uppercase mt-2 pt-2 border-t border-border/50">
                          <span className="flex items-center gap-1 border border-border px-1.5 py-0.5 rounded"><User className="w-3 h-3" /> {task.assignedWorkerId ? `OP-${task.assignedWorkerId}` : 'Unassigned'}</span>
                          {task.estimatedMinutes && (
                            <span className="flex items-center gap-1 border border-border px-1.5 py-0.5 rounded bg-muted/20">
                              <Clock className="w-3 h-3" /> {task.estimatedMinutes}m
                            </span>
                          )}
                        </div>
                        {status === 'blocked' && (
                           <Button 
                             size="sm" 
                             className="w-full mt-3 h-7 text-[9px] font-mono uppercase bg-ai/10 text-ai border border-ai/30 hover:bg-ai/20"
                             onClick={(e) => { e.stopPropagation(); handleAIReassign(task.id); }}
                             disabled={reassignTask.isPending}
                           >
                             <Cpu className="w-3 h-3 mr-1" /> AI Resolve
                           </Button>
                        )}
                      </CardContent>
                    </Card>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      <Dialog open={aiModalOpen} onOpenChange={setAiModalOpen}>
        <DialogContent className="bg-card border-ai/30 shadow-[0_0_50px_rgba(var(--color-ai),0.1)]">
          <DialogHeader>
             <DialogTitle className="font-mono text-ai uppercase tracking-widest flex items-center gap-2">
               <Cpu className="w-5 h-5" /> AI Routing Directive
             </DialogTitle>
          </DialogHeader>
          <div className="p-4 bg-ai/5 border border-ai/20 rounded font-mono text-sm text-foreground leading-relaxed whitespace-pre-wrap">
            {aiReasoning}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
