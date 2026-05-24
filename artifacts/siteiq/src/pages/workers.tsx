import { useListWorkers } from "@workspace/api-client-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Users } from "lucide-react";

export default function Workers() {
  const { data: workers, isLoading } = useListWorkers();

  return (
    <div className="space-y-6 fade-in-up">
      <div>
        <h1 className="text-3xl font-mono font-bold tracking-tight text-foreground uppercase flex items-center gap-3">
          <Users className="w-8 h-8 text-primary" />
          Personnel Roster
        </h1>
        <p className="text-sm font-mono text-muted-foreground mt-1 uppercase tracking-widest">Active Site Operators & Contractors</p>
      </div>

      <div className="rounded-xl border border-border bg-card/40 backdrop-blur overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="border-border hover:bg-transparent">
              <TableHead className="font-mono text-xs uppercase text-muted-foreground">ID / Name</TableHead>
              <TableHead className="font-mono text-xs uppercase text-muted-foreground">Trade</TableHead>
              <TableHead className="font-mono text-xs uppercase text-muted-foreground">Zone</TableHead>
              <TableHead className="font-mono text-xs uppercase text-muted-foreground">Status</TableHead>
              <TableHead className="font-mono text-xs uppercase text-muted-foreground text-right">PPE Score</TableHead>
              <TableHead className="font-mono text-xs uppercase text-muted-foreground text-right">Fatigue</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-8 font-mono text-muted-foreground">Loading roster data...</TableCell>
              </TableRow>
            ) : workers?.map((worker) => (
              <TableRow key={worker.id} className="border-border hover:bg-white/[0.02]">
                <TableCell className="font-mono">
                  <div className="font-medium text-foreground">{worker.name}</div>
                  <div className="text-[10px] text-muted-foreground opacity-50">OP-{worker.id.toString().padStart(4, '0')}</div>
                </TableCell>
                <TableCell className="font-mono text-sm">{worker.trade}</TableCell>
                <TableCell className="font-mono text-sm">
                  <Badge variant="outline" className="font-mono bg-background border-border text-foreground">
                    Sector {worker.zone}
                  </Badge>
                </TableCell>
                <TableCell>
                  <Badge variant="outline" className={`font-mono text-xs ${
                    worker.status === 'active' ? 'border-safe text-safe bg-safe/10' :
                    worker.status === 'break' ? 'border-info text-info bg-info/10' :
                    'border-muted text-muted-foreground bg-muted/20'
                  }`}>
                    {worker.status}
                  </Badge>
                </TableCell>
                <TableCell className="text-right font-mono">
                  <div className={`inline-flex items-center gap-2 ${worker.ppeScore < 80 ? 'text-critical' : 'text-safe'}`}>
                    {worker.ppeScore}%
                  </div>
                </TableCell>
                <TableCell className="text-right font-mono">
                  <div className={`inline-flex items-center gap-2 ${worker.fatigueScore > 70 ? 'text-critical' : worker.fatigueScore > 40 ? 'text-warning' : 'text-safe'}`}>
                    {worker.fatigueScore}%
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
