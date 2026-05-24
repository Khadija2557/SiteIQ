import { useState } from "react";
import { useListMachines, useUpdateMachine, getListMachinesQueryKey } from "@workspace/api-client-react";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useQueryClient } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";

export default function Machines() {
  const queryClient = useQueryClient();
  const { data: machines, isLoading } = useListMachines();
  const updateMachineMutation = useUpdateMachine();

  const handleStatusUpdate = (id: number, newStatus: string) => {
    updateMachineMutation.mutate({
      id,
      data: { status: newStatus }
    }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListMachinesQueryKey() });
      }
    });
  };

  if (isLoading) return <div className="p-8">LOADING MACHINES...</div>;

  return (
    <div className="p-8 space-y-6">
      <div className="flex justify-between items-end">
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-foreground">EQUIPMENT TRACKER</h2>
          <p className="text-muted-foreground uppercase tracking-widest text-xs mt-1">Heavy Machinery Telemetry</p>
        </div>
      </div>

      <Card className="bg-card border-border">
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="border-border hover:bg-transparent">
                <TableHead className="font-bold text-muted-foreground uppercase tracking-wider">ID</TableHead>
                <TableHead className="font-bold text-muted-foreground uppercase tracking-wider">Name</TableHead>
                <TableHead className="font-bold text-muted-foreground uppercase tracking-wider">Type</TableHead>
                <TableHead className="font-bold text-muted-foreground uppercase tracking-wider">Zone</TableHead>
                <TableHead className="font-bold text-muted-foreground uppercase tracking-wider">Status</TableHead>
                <TableHead className="font-bold text-muted-foreground uppercase tracking-wider text-right">Update Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {machines?.map((machine) => (
                <TableRow key={machine.id} className="border-border">
                  <TableCell className="font-mono text-muted-foreground text-xs">#{machine.id}</TableCell>
                  <TableCell className="font-medium">{machine.name}</TableCell>
                  <TableCell className="uppercase text-xs">{machine.type.replace('_', ' ')}</TableCell>
                  <TableCell>{machine.zone}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className={`uppercase text-[10px] rounded-sm ${
                      machine.status === 'operating' ? 'border-primary text-primary' :
                      machine.status === 'maintenance' ? 'border-destructive text-destructive' :
                      machine.status === 'offline' ? 'border-muted text-muted-foreground' : ''
                    }`}>
                      {machine.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <Select 
                      defaultValue={machine.status} 
                      onValueChange={(val) => handleStatusUpdate(machine.id, val)}
                    >
                      <SelectTrigger className="w-32 h-8 text-xs font-mono ml-auto">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="idle">Idle</SelectItem>
                        <SelectItem value="operating">Operating</SelectItem>
                        <SelectItem value="maintenance">Maintenance</SelectItem>
                        <SelectItem value="offline">Offline</SelectItem>
                      </SelectContent>
                    </Select>
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