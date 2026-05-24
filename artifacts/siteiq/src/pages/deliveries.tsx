import { useListDeliveries } from "@workspace/api-client-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Package, Clock } from "lucide-react";

export default function Deliveries() {
  const { data: deliveries, isLoading } = useListDeliveries();

  return (
    <div className="space-y-6 fade-in-up">
      <div>
        <h1 className="text-3xl font-mono font-bold tracking-tight text-foreground uppercase flex items-center gap-3">
          <Package className="w-8 h-8 text-primary" />
          Logistics
        </h1>
        <p className="text-sm font-mono text-muted-foreground mt-1 uppercase tracking-widest">Inbound Material & Gate Scheduling</p>
      </div>

      <div className="rounded-xl border border-border bg-card/40 backdrop-blur overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="border-border hover:bg-transparent">
              <TableHead className="font-mono text-xs uppercase text-muted-foreground">ID</TableHead>
              <TableHead className="font-mono text-xs uppercase text-muted-foreground">Material</TableHead>
              <TableHead className="font-mono text-xs uppercase text-muted-foreground">Gate</TableHead>
              <TableHead className="font-mono text-xs uppercase text-muted-foreground">Status</TableHead>
              <TableHead className="font-mono text-xs uppercase text-muted-foreground text-right">ETA</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center py-8 font-mono text-muted-foreground">Loading logistics manifest...</TableCell>
              </TableRow>
            ) : deliveries?.map((delivery) => (
              <TableRow key={delivery.id} className="border-border hover:bg-white/[0.02]">
                <TableCell className="font-mono text-muted-foreground">
                  SHP-{delivery.id.toString().padStart(4, '0')}
                </TableCell>
                <TableCell className="font-mono">
                  <div className="font-medium text-foreground">{delivery.materialType}</div>
                  <div className="text-[10px] text-muted-foreground">QTY: {delivery.quantity}</div>
                </TableCell>
                <TableCell className="font-mono text-sm">
                  <Badge variant="outline" className="font-mono bg-background border-border text-foreground">
                    {delivery.gate}
                  </Badge>
                </TableCell>
                <TableCell>
                  <Badge variant="outline" className={`font-mono text-xs ${
                    delivery.status === 'arrived' ? 'border-safe text-safe bg-safe/10' :
                    delivery.status === 'delayed' ? 'border-critical text-critical bg-critical/10' :
                    'border-info text-info bg-info/10'
                  }`}>
                    {delivery.status}
                  </Badge>
                </TableCell>
                <TableCell className="text-right font-mono">
                  {delivery.eta ? (
                    <div className="inline-flex items-center gap-1.5 text-muted-foreground">
                      <Clock className="w-3 h-3" />
                      {new Date(delivery.eta).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                    </div>
                  ) : (
                    <span className="text-muted-foreground">TBD</span>
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
