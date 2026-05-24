import { useState } from "react";
import { useListTasks, useCreateTask, useAiAssignTask } from "@workspace/api-client-react";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { getListTasksQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { Badge } from "@/components/ui/badge";

const taskSchema = z.object({
  title: z.string().min(2),
  priority: z.string().min(1),
  zone: z.string().min(1),
  status: z.string().min(1),
});

export default function Tasks() {
  const queryClient = useQueryClient();
  const { data: tasks, isLoading } = useListTasks();
  const createMutation = useCreateTask();
  const aiAssignMutation = useAiAssignTask();
  const [selectedTask, setSelectedTask] = useState<number | null>(null);
  const [aiAssignOpen, setAiAssignOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);

  const form = useForm<z.infer<typeof taskSchema>>({
    resolver: zodResolver(taskSchema),
    defaultValues: {
      title: "",
      priority: "medium",
      zone: "Zone A",
      status: "todo",
    },
  });

  const onSubmit = (values: z.infer<typeof taskSchema>) => {
    createMutation.mutate({ data: values }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListTasksQueryKey() });
        setCreateOpen(false);
        form.reset();
      }
    });
  };

  const handleAiAssign = (taskId: number) => {
    aiAssignMutation.mutate({ data: { task_id: taskId } }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListTasksQueryKey() });
      }
    });
  };

  if (isLoading) return <div className="p-8">LOADING TASKS...</div>;

  return (
    <div className="p-8 space-y-6">
      <div className="flex justify-between items-end">
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-foreground">TASK BOARD</h2>
          <p className="text-muted-foreground uppercase tracking-widest text-xs mt-1">Operational Objectives</p>
        </div>
        
        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogTrigger asChild>
            <Button>CREATE TASK</Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[425px] font-mono">
            <DialogHeader>
              <DialogTitle className="uppercase tracking-wider">Create Task</DialogTitle>
            </DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="title"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>TITLE</FormLabel>
                      <FormControl>
                        <Input placeholder="E.g., Inspect Crane" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="priority"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>PRIORITY</FormLabel>
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
                  name="status"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>STATUS</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="todo">To Do</SelectItem>
                          <SelectItem value="in_progress">In Progress</SelectItem>
                          <SelectItem value="blocked">Blocked</SelectItem>
                          <SelectItem value="complete">Complete</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <div className="flex justify-end pt-4">
                  <Button type="submit" disabled={createMutation.isPending}>
                    {createMutation.isPending ? "SAVING..." : "SAVE TASK"}
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
                <TableHead className="font-bold text-muted-foreground uppercase tracking-wider">Title</TableHead>
                <TableHead className="font-bold text-muted-foreground uppercase tracking-wider">Zone</TableHead>
                <TableHead className="font-bold text-muted-foreground uppercase tracking-wider">Status</TableHead>
                <TableHead className="font-bold text-muted-foreground uppercase tracking-wider">Priority</TableHead>
                <TableHead className="font-bold text-muted-foreground uppercase tracking-wider text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {tasks?.map((task) => (
                <TableRow key={task.id} className="border-border">
                  <TableCell className="font-mono text-muted-foreground text-xs">#{task.id}</TableCell>
                  <TableCell className="font-medium">{task.title}</TableCell>
                  <TableCell>{task.zone}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className="uppercase text-[10px] rounded-sm">
                      {task.status.replace('_', ' ')}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <span className={`uppercase text-xs font-bold ${
                      task.priority === 'critical' ? 'text-destructive' :
                      task.priority === 'high' ? 'text-amber-500' :
                      task.priority === 'medium' ? 'text-primary' : 'text-muted-foreground'
                    }`}>
                      {task.priority}
                    </span>
                  </TableCell>
                  <TableCell className="text-right">
                    <Button 
                      variant="outline" 
                      size="sm" 
                      className="h-8 text-xs font-bold uppercase tracking-wider"
                      onClick={() => {
                        setSelectedTask(task.id);
                        setAiAssignOpen(true);
                      }}
                      disabled={task.status === 'complete'}
                    >
                      AI Assign
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={aiAssignOpen} onOpenChange={setAiAssignOpen}>
        <DialogContent className="sm:max-w-[500px] font-mono">
          <DialogHeader>
            <DialogTitle className="uppercase tracking-wider text-primary">AI Assignment Engine</DialogTitle>
          </DialogHeader>
          <div className="py-6 flex flex-col items-center justify-center text-center space-y-4">
            <p className="text-sm text-muted-foreground">
              Initiating AI candidate search and optimization for task #{selectedTask}...
            </p>
            {aiAssignMutation.isPending ? (
              <div className="animate-pulse text-primary font-bold tracking-widest">COMPUTING...</div>
            ) : aiAssignMutation.isSuccess && !aiAssignMutation.isIdle ? (
              <div className="space-y-4 w-full text-left">
                <div className="bg-primary/10 border border-primary/20 p-4 rounded text-sm">
                  <p className="font-bold text-primary mb-2 uppercase">Assignment Complete</p>
                  <p className="text-foreground leading-relaxed">
                    {aiAssignMutation.data?.explanation}
                  </p>
                </div>
                <div className="flex justify-end">
                  <Button onClick={() => setAiAssignOpen(false)}>CLOSE</Button>
                </div>
              </div>
            ) : (
              <Button 
                onClick={() => selectedTask && handleAiAssign(selectedTask)}
                className="w-full"
              >
                EXECUTE OPTIMIZATION
              </Button>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}