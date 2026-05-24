import { useListAlerts, useAcknowledgeAlert, getListAlertsQueryKey } from "@workspace/api-client-react";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { useQueryClient } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";

export default function Alerts() {
  const queryClient = useQueryClient();
  const { data: alerts, isLoading } = useListAlerts({ acknowledged: false });
  const ackMutation = useAcknowledgeAlert();

  const handleAcknowledge = (id: number) => {
    ackMutation.mutate({ id }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListAlertsQueryKey() });
      }
    });
  };

  if (isLoading) return <div className="p-8">LOADING ALERTS...</div>;

  return (
    <div className="p-8 space-y-6">
      <div className="flex justify-between items-end">
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-foreground">ALERTS INBOX</h2>
          <p className="text-muted-foreground uppercase tracking-widest text-xs mt-1">System Notifications</p>
        </div>
      </div>

      <Card className="bg-card border-border">
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="border-border hover:bg-transparent">
                <TableHead className="font-bold text-muted-foreground uppercase tracking-wider">Type</TableHead>
                <TableHead className="font-bold text-muted-foreground uppercase tracking-wider">Message</TableHead>
                <TableHead className="font-bold text-muted-foreground uppercase tracking-wider">Severity</TableHead>
                <TableHead className="font-bold text-muted-foreground uppercase tracking-wider">Time</TableHead>
                <TableHead className="font-bold text-muted-foreground uppercase tracking-wider text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {alerts?.map((alert) => (
                <TableRow key={alert.id} className="border-border">
                  <TableCell className="uppercase text-xs font-bold">{alert.type.replace('_', ' ')}</TableCell>
                  <TableCell className="max-w-[400px] truncate">{alert.message}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className={`uppercase text-[10px] rounded-sm ${
                      alert.severity === 'critical' ? 'border-destructive text-destructive' :
                      alert.severity === 'high' ? 'border-amber-500 text-amber-500' :
                      'border-primary text-primary'
                    }`}>
                      {alert.severity}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground font-mono">
                    {new Date(alert.createdAt).toLocaleTimeString()}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button 
                      variant="outline" 
                      size="sm" 
                      className="h-8 text-xs font-bold uppercase tracking-wider"
                      onClick={() => handleAcknowledge(alert.id)}
                      disabled={ackMutation.isPending}
                    >
                      ACKNOWLEDGE
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
              {alerts?.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8 text-muted-foreground uppercase tracking-widest text-sm">
                    Inbox Zero
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