import { useListCameras } from "@workspace/api-client-react";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";

export default function Cameras() {
  const { data: cameras, isLoading } = useListCameras();

  if (isLoading) return <div className="p-8">LOADING CAMERAS...</div>;

  return (
    <div className="p-8 space-y-6">
      <div className="flex justify-between items-end">
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-foreground">CV CAMERAS</h2>
          <p className="text-muted-foreground uppercase tracking-widest text-xs mt-1">Computer Vision Feeds</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
        {cameras?.map(camera => (
          <Card key={camera.id} className="bg-card border-border overflow-hidden">
            <div className="aspect-video bg-muted relative flex items-center justify-center">
              <div className="absolute top-2 right-2 flex gap-2">
                <Badge variant="outline" className="bg-background/80 backdrop-blur text-[10px] uppercase font-mono">
                  {camera.zone}
                </Badge>
                <Badge variant="outline" className={`bg-background/80 backdrop-blur text-[10px] uppercase font-mono ${
                  camera.status === 'active' ? 'text-primary border-primary' : 'text-destructive border-destructive'
                }`}>
                  {camera.status}
                </Badge>
              </div>
              <div className="text-muted-foreground uppercase tracking-widest text-xs">
                {camera.status === 'active' ? 'NO SIGNAL (MOCK)' : 'OFFLINE'}
              </div>
            </div>
            <CardContent className="p-3">
              <div className="flex justify-between items-center">
                <span className="font-bold text-sm">{camera.name}</span>
                <span className="text-[10px] text-muted-foreground font-mono">ID: {camera.id}</span>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="bg-card border-border">
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="border-border hover:bg-transparent">
                <TableHead className="font-bold text-muted-foreground uppercase tracking-wider">ID</TableHead>
                <TableHead className="font-bold text-muted-foreground uppercase tracking-wider">Name</TableHead>
                <TableHead className="font-bold text-muted-foreground uppercase tracking-wider">Zone</TableHead>
                <TableHead className="font-bold text-muted-foreground uppercase tracking-wider">Status</TableHead>
                <TableHead className="font-bold text-muted-foreground uppercase tracking-wider text-right">Last Frame</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {cameras?.map((camera) => (
                <TableRow key={camera.id} className="border-border">
                  <TableCell className="font-mono text-muted-foreground text-xs">#{camera.id}</TableCell>
                  <TableCell className="font-medium text-sm">{camera.name}</TableCell>
                  <TableCell>{camera.zone}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className={`uppercase text-[10px] rounded-sm ${
                      camera.status === 'active' ? 'text-primary border-primary' : 'text-destructive border-destructive'
                    }`}>
                      {camera.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right text-xs text-muted-foreground font-mono">
                    {camera.lastFrameAt ? new Date(camera.lastFrameAt).toLocaleTimeString() : 'N/A'}
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