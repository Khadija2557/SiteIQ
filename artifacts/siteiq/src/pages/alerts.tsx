import { useState, useEffect } from "react";
import { useListAlerts, useAcknowledgeAlert, getListAlertsQueryKey } from "@workspace/api-client-react";
import { socket } from "@/lib/socket";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { BellRing, ShieldAlert, Check, Download, Info, AlertTriangle, X } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";

export default function Alerts() {
  const [severityFilter, setSeverityFilter] = useState("all");
  const [selectedAlert, setSelectedAlert] = useState<any>(null);
  const queryClient = useQueryClient();
  const { toast } = useToast();
  
  const { data: alerts, isLoading } = useListAlerts({
    severity: severityFilter !== 'all' ? severityFilter : undefined
  });
  
  const acknowledgeAlert = useAcknowledgeAlert();

  useEffect(() => {
    socket.connect();
    const handleNewAlert = () => {
      queryClient.invalidateQueries({ queryKey: getListAlertsQueryKey() });
    };
    socket.on("alerts_update", handleNewAlert);
    return () => {
      socket.off("alerts_update", handleNewAlert);
      socket.disconnect();
    };
  }, [queryClient]);

  const handleAcknowledge = (id: number) => {
    acknowledgeAlert.mutate({ id }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListAlertsQueryKey() });
        if(selectedAlert?.id === id) setSelectedAlert({...selectedAlert, acknowledged: true});
      }
    });
  };

  const handleAcknowledgeAll = () => {
    const unack = alerts?.filter(a => !a.acknowledged) || [];
    unack.forEach(a => {
      acknowledgeAlert.mutate({ id: a.id });
    });
    setTimeout(() => {
      queryClient.invalidateQueries({ queryKey: getListAlertsQueryKey() });
      toast({ title: "Clearance Complete", description: "All alerts marked as acknowledged." });
    }, 500);
  };

  const handleExport = () => {
    if (!alerts) return;
    const csvContent = "data:text/csv;charset=utf-8," 
      + "ID,Severity,Type,Message,Zone,Time,Acknowledged\n"
      + alerts.map(a => `${a.id},${a.severity},${a.type},"${a.message}",${a.zone||''},${a.createdAt},${a.acknowledged}`).join("\n");
    
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `siteiq_alerts_${new Date().getTime()}.csv`);
    document.body.appendChild(link);
    link.click();
    link.remove();
  };

  const getSeverityIcon = (severity: string) => {
    if(severity === 'critical') return <ShieldAlert className="w-4 h-4 text-critical animate-pulse" />;
    if(severity === 'warning') return <AlertTriangle className="w-4 h-4 text-warning" />;
    return <Info className="w-4 h-4 text-info" />;
  };

  return (
    <div className="flex h-full gap-6">
      <div className={`flex-1 space-y-6 transition-all duration-300 ${selectedAlert ? 'mr-[350px]' : ''}`}>
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-3xl font-mono font-bold tracking-tight text-foreground uppercase flex items-center gap-3">
              <BellRing className="w-8 h-8 text-primary" /> Incident Log
            </h1>
            <p className="text-sm font-mono text-muted-foreground mt-1 uppercase tracking-widest">System Notifications & Alarms</p>
          </div>
          
          <div className="flex gap-2">
            <Button variant="outline" className="font-mono uppercase text-xs" onClick={handleExport}>
              <Download className="w-4 h-4 mr-2" /> Export Log
            </Button>
            <Button variant="outline" className="font-mono uppercase text-xs text-safe border-safe/30 hover:bg-safe/10" onClick={handleAcknowledgeAll}>
              <Check className="w-4 h-4 mr-2" /> Ack All
            </Button>
          </div>
        </div>

        <Tabs defaultValue="all" value={severityFilter} onValueChange={setSeverityFilter} className="w-full">
          <TabsList className="bg-card border border-border h-10">
            <TabsTrigger value="all" className="font-mono text-[10px] uppercase">All Signals</TabsTrigger>
            <TabsTrigger value="critical" className="font-mono text-[10px] uppercase text-critical data-[state=active]:text-critical">Critical</TabsTrigger>
            <TabsTrigger value="warning" className="font-mono text-[10px] uppercase text-warning data-[state=active]:text-warning">Warning</TabsTrigger>
            <TabsTrigger value="info" className="font-mono text-[10px] uppercase text-info data-[state=active]:text-info">Info</TabsTrigger>
          </TabsList>
        </Tabs>

        <div className="rounded-sm border border-border bg-card overflow-hidden">
          <Table>
            <TableHeader className="bg-muted/20">
              <TableRow className="border-border hover:bg-transparent">
                <TableHead className="w-12"></TableHead>
                <TableHead className="font-mono text-[10px] uppercase text-muted-foreground tracking-widest">Signal</TableHead>
                <TableHead className="font-mono text-[10px] uppercase text-muted-foreground tracking-widest max-w-[300px]">Detail</TableHead>
                <TableHead className="font-mono text-[10px] uppercase text-muted-foreground tracking-widest">Zone</TableHead>
                <TableHead className="font-mono text-[10px] uppercase text-muted-foreground tracking-widest">Timestamp</TableHead>
                <TableHead className="font-mono text-[10px] uppercase text-muted-foreground tracking-widest text-right">Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={6} className="text-center py-8 font-mono text-muted-foreground">Intercepting signals...</TableCell></TableRow>
              ) : alerts?.map((alert) => (
                <TableRow 
                  key={alert.id} 
                  className={`border-border hover:bg-muted/10 cursor-pointer ${selectedAlert?.id === alert.id ? 'bg-primary/5 border-primary/20' : ''}`}
                  onClick={() => setSelectedAlert(alert)}
                >
                  <TableCell>{getSeverityIcon(alert.severity)}</TableCell>
                  <TableCell className="font-mono">
                    <Badge variant="outline" className={`font-mono text-[9px] uppercase px-1.5 py-0 ${
                      alert.severity === 'critical' ? 'border-critical text-critical' :
                      alert.severity === 'warning' ? 'border-warning text-warning' :
                      'border-info text-info'
                    }`}>
                      {alert.type}
                    </Badge>
                  </TableCell>
                  <TableCell className="font-mono text-[11px] truncate max-w-[300px] text-foreground">{alert.message}</TableCell>
                  <TableCell>
                    {alert.zone ? <Badge variant="outline" className="font-mono text-[9px] bg-background border-border text-foreground uppercase px-1.5 py-0">Z-{alert.zone}</Badge> : '-'}
                  </TableCell>
                  <TableCell className="font-mono text-[10px] text-muted-foreground tracking-wider">
                    {new Date(alert.createdAt).toLocaleString(undefined, {month:'short', day:'numeric', hour:'2-digit', minute:'2-digit'})}
                  </TableCell>
                  <TableCell className="text-right">
                    {alert.acknowledged ? (
                      <span className="font-mono text-[10px] text-muted-foreground uppercase">Cleared</span>
                    ) : (
                      <Button size="sm" variant="outline" className="h-6 px-2 text-[9px] font-mono uppercase" onClick={(e) => { e.stopPropagation(); handleAcknowledge(alert.id); }}>Ack</Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>

      <div className={`fixed top-0 right-0 h-full w-[350px] bg-card border-l border-border shadow-2xl transform transition-transform duration-300 z-40 flex flex-col ${selectedAlert ? 'translate-x-0' : 'translate-x-full'}`}>
        {selectedAlert && (
          <>
            <div className="p-4 border-b border-border flex justify-between items-center bg-muted/10">
              <h2 className="font-mono text-sm font-bold uppercase tracking-widest text-primary flex items-center gap-2">
                {getSeverityIcon(selectedAlert.severity)} Incident {selectedAlert.id}
              </h2>
              <Button variant="ghost" size="icon" onClick={() => setSelectedAlert(null)}><X className="w-4 h-4"/></Button>
            </div>
            <div className="p-6 flex-1 overflow-y-auto custom-scrollbar space-y-6">
              <div>
                <Badge variant="outline" className={`mb-3 font-mono text-[10px] uppercase px-2 py-0.5 ${
                  selectedAlert.severity === 'critical' ? 'border-critical text-critical bg-critical/10' :
                  selectedAlert.severity === 'warning' ? 'border-warning text-warning bg-warning/10' :
                  'border-info text-info bg-info/10'
                }`}>
                  {selectedAlert.severity} Priority
                </Badge>
                <h3 className="text-lg font-bold font-mono uppercase text-foreground leading-tight">{selectedAlert.message}</h3>
                <p className="text-xs font-mono text-muted-foreground uppercase tracking-widest mt-2 bg-background p-2 border border-border rounded">{selectedAlert.type}</p>
              </div>

              <div className="space-y-3">
                <div className="flex justify-between items-center py-2 border-b border-border/50">
                  <span className="font-mono text-[10px] text-muted-foreground uppercase tracking-widest">Time</span>
                  <span className="font-mono text-xs">{new Date(selectedAlert.createdAt).toLocaleString()}</span>
                </div>
                <div className="flex justify-between items-center py-2 border-b border-border/50">
                  <span className="font-mono text-[10px] text-muted-foreground uppercase tracking-widest">Location</span>
                  <span className="font-mono text-xs uppercase">{selectedAlert.zone ? `Zone ${selectedAlert.zone}` : 'Global'}</span>
                </div>
                {selectedAlert.workerId && (
                  <div className="flex justify-between items-center py-2 border-b border-border/50">
                    <span className="font-mono text-[10px] text-muted-foreground uppercase tracking-widest">Personnel Tag</span>
                    <span className="font-mono text-xs text-worker">OP-{selectedAlert.workerId}</span>
                  </div>
                )}
                {selectedAlert.machineId && (
                  <div className="flex justify-between items-center py-2 border-b border-border/50">
                    <span className="font-mono text-[10px] text-muted-foreground uppercase tracking-widest">Asset Tag</span>
                    <span className="font-mono text-xs text-machine">MAC-{selectedAlert.machineId}</span>
                  </div>
                )}
              </div>
            </div>
            <div className="p-4 border-t border-border bg-muted/10">
               <Button 
                 className={`w-full font-mono uppercase ${selectedAlert.acknowledged ? 'bg-muted text-muted-foreground' : 'bg-primary hover:bg-primary/90'}`}
                 onClick={() => handleAcknowledge(selectedAlert.id)}
                 disabled={selectedAlert.acknowledged || acknowledgeAlert.isPending}
               >
                 <Check className="w-4 h-4 mr-2" /> {selectedAlert.acknowledged ? 'Signal Cleared' : 'Acknowledge Signal'}
               </Button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
