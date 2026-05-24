import { useState } from "react";
import { useListReports, useGenerateReport, getListReportsQueryKey } from "@workspace/api-client-react";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { Download, FileText } from "lucide-react";

const reportSchema = z.object({
  type: z.string().min(1),
});

export default function Reports() {
  const queryClient = useQueryClient();
  const { data: reports, isLoading } = useListReports();
  const generateMutation = useGenerateReport();
  const [open, setOpen] = useState(false);

  const form = useForm<z.infer<typeof reportSchema>>({
    resolver: zodResolver(reportSchema),
    defaultValues: {
      type: "daily_progress",
    },
  });

  const onSubmit = (values: z.infer<typeof reportSchema>) => {
    generateMutation.mutate({ data: values }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListReportsQueryKey() });
        setOpen(false);
        form.reset();
      }
    });
  };

  if (isLoading) return <div className="p-8">LOADING REPORTS...</div>;

  return (
    <div className="p-8 space-y-6">
      <div className="flex justify-between items-end">
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-foreground">REPORTS</h2>
          <p className="text-muted-foreground uppercase tracking-widest text-xs mt-1">Compliance & Analytics</p>
        </div>
        
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button>GENERATE REPORT</Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[425px] font-mono">
            <DialogHeader>
              <DialogTitle className="uppercase tracking-wider">Generate New Report</DialogTitle>
            </DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="type"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>REPORT TYPE</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="daily_progress">Daily Progress</SelectItem>
                          <SelectItem value="safety_audit">Safety Audit</SelectItem>
                          <SelectItem value="incident_summary">Incident Summary</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <div className="flex justify-end pt-4">
                  <Button type="submit" disabled={generateMutation.isPending}>
                    {generateMutation.isPending ? "GENERATING..." : "GENERATE"}
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
                <TableHead className="font-bold text-muted-foreground uppercase tracking-wider w-12"><FileText className="h-4 w-4" /></TableHead>
                <TableHead className="font-bold text-muted-foreground uppercase tracking-wider">Date</TableHead>
                <TableHead className="font-bold text-muted-foreground uppercase tracking-wider">Type</TableHead>
                <TableHead className="font-bold text-muted-foreground uppercase tracking-wider text-right">Download</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {reports?.map((report) => (
                <TableRow key={report.id} className="border-border">
                  <TableCell className="font-mono text-muted-foreground text-xs">#{report.id}</TableCell>
                  <TableCell className="font-mono text-xs">
                    {new Date(report.date).toLocaleDateString()}
                  </TableCell>
                  <TableCell className="uppercase text-xs font-bold">
                    {report.type.replace('_', ' ')}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      className="h-8 w-8 p-0"
                      disabled={!report.pdfUrl}
                    >
                      <Download className="h-4 w-4" />
                      <span className="sr-only">Download</span>
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
              {reports?.length === 0 && (
                <TableRow>
                  <TableCell colSpan={4} className="text-center py-8 text-muted-foreground uppercase tracking-widest text-sm">
                    No Reports Generated
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