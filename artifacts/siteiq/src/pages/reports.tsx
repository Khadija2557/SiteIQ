import { useListReports, useGenerateReport, getListReportsQueryKey } from "@workspace/api-client-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { FileText, Download, Loader2, ChevronDown } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";

const REPORT_TYPES = [
  { id: "daily_safety", label: "Daily Safety Report" },
  { id: "machine_utilization", label: "Machine Utilization" },
  { id: "worker_productivity", label: "Worker Productivity" },
  { id: "incident_summary", label: "Incident Summary" }
];

export default function Reports() {
  const { data: reports, isLoading } = useListReports();
  const generateReport = useGenerateReport();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const handleGenerate = (type: string) => {
    generateReport.mutate({ data: { type } }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListReportsQueryKey() });
        toast({ title: "Report Generated", description: "Document compiled and stored in repository." });
      }
    });
  };

  return (
    <div className="space-y-6 fade-in-up">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-mono font-bold tracking-tight text-foreground uppercase flex items-center gap-3">
            <FileText className="w-8 h-8 text-primary" /> Reports
          </h1>
          <p className="text-sm font-mono text-muted-foreground mt-1 uppercase tracking-widest">Document Generation & Archival</p>
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button className="font-mono uppercase tracking-wider text-xs" disabled={generateReport.isPending}>
              {generateReport.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <FileText className="w-4 h-4 mr-2" />}
              Compile Report <ChevronDown className="w-4 h-4 ml-2 opacity-50" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent className="bg-card border-border font-mono text-xs uppercase" align="end">
            {REPORT_TYPES.map(rt => (
              <DropdownMenuItem key={rt.id} className="cursor-pointer focus:bg-primary/20 focus:text-primary" onClick={() => handleGenerate(rt.id)}>
                {rt.label}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <div className="rounded-sm border border-border bg-card shadow-sm overflow-hidden">
        <Table>
          <TableHeader className="bg-muted/20">
            <TableRow className="border-border hover:bg-transparent">
              <TableHead className="font-mono text-[10px] uppercase text-muted-foreground tracking-widest">Doc ID</TableHead>
              <TableHead className="font-mono text-[10px] uppercase text-muted-foreground tracking-widest">Classification</TableHead>
              <TableHead className="font-mono text-[10px] uppercase text-muted-foreground tracking-widest">Timestamp</TableHead>
              <TableHead className="font-mono text-[10px] uppercase text-muted-foreground tracking-widest text-right">Action</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={4} className="text-center py-8 font-mono text-muted-foreground">Accessing archives...</TableCell></TableRow>
            ) : reports?.map((report) => (
              <TableRow key={report.id} className="border-border hover:bg-muted/10">
                <TableCell className="font-mono text-[10px] tracking-widest text-muted-foreground">
                  DOC-{report.id.toString().padStart(5, '0')}
                </TableCell>
                <TableCell className="font-mono">
                  <div className="font-bold text-foreground uppercase text-xs">{report.type.replace('_', ' ')}</div>
                </TableCell>
                <TableCell className="font-mono text-[10px] uppercase text-muted-foreground tracking-widest">
                  {new Date(report.date).toLocaleString(undefined, {month:'short', day:'numeric', year:'numeric', hour:'2-digit', minute:'2-digit'})}
                </TableCell>
                <TableCell className="text-right">
                  <Button 
                    size="sm" 
                    variant="outline" 
                    className="font-mono text-[9px] h-7 uppercase border-primary/30 text-primary hover:bg-primary/10 hover:text-primary"
                    onClick={() => {
                      if (report.pdfUrl) window.open(report.pdfUrl, '_blank');
                      else toast({ title: "Download Initiated", description: "Transferring file payload." });
                    }}
                  >
                    <Download className="w-3 h-3 mr-2" /> Retrieve
                  </Button>
                </TableCell>
              </TableRow>
            ))}
            {!reports?.length && !isLoading && (
              <TableRow>
                <TableCell colSpan={4} className="text-center py-8 font-mono text-muted-foreground uppercase tracking-widest">
                  No records found in archive.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
