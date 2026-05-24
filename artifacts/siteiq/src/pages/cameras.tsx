import { useState, useEffect, useRef } from "react";
import { useListCameras } from "@workspace/api-client-react";
import { Card, CardContent } from "@/components/ui/card";
import { Video, Activity, Maximize2, X } from "lucide-react";
import { Dialog, DialogContent, DialogTitle, DialogClose } from "@/components/ui/dialog";

// Simulated detection boxes
const drawDetections = (ctx: CanvasRenderingContext2D, width: number, height: number) => {
  ctx.clearRect(0, 0, width, height);
  
  // Persons (cyan)
  const persons = Math.floor(Math.random() * 3) + 1;
  ctx.strokeStyle = "hsl(189 94% 43%)";
  ctx.lineWidth = 2;
  ctx.fillStyle = "rgba(6, 182, 212, 0.2)";
  for(let i=0; i<persons; i++) {
    const x = Math.random() * (width - 40);
    const y = Math.random() * (height - 80) + 20;
    const w = 30 + Math.random() * 20;
    const h = 60 + Math.random() * 30;
    ctx.strokeRect(x, y, w, h);
    ctx.fillRect(x, y, w, h);
    
    // Label
    ctx.fillStyle = "hsl(189 94% 43%)";
    ctx.font = "10px monospace";
    ctx.fillText(`P-${Math.floor(Math.random()*99)}`, x, y - 4);
    ctx.fillStyle = "rgba(6, 182, 212, 0.2)";
  }

  // Machines (amber)
  if (Math.random() > 0.5) {
    ctx.strokeStyle = "hsl(38 92% 50%)";
    ctx.fillStyle = "rgba(245, 158, 11, 0.2)";
    const x = Math.random() * (width - 100);
    const y = Math.random() * (height - 80);
    const w = 80 + Math.random() * 60;
    const h = 60 + Math.random() * 40;
    ctx.strokeRect(x, y, w, h);
    ctx.fillRect(x, y, w, h);
    
    ctx.fillStyle = "hsl(38 92% 50%)";
    ctx.fillText(`M-SYS`, x, y - 4);
  }

  return { persons, machines: Math.random() > 0.5 ? 1 : 0 };
};

const CameraFeed = ({ camera, isModal = false, onClick }: any) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [stats, setStats] = useState({ persons: 0, machines: 0, fps: 24 });

  useEffect(() => {
    let interval: any;
    if (camera.status !== 'offline') {
      interval = setInterval(() => {
        const canvas = canvasRef.current;
        if (canvas) {
          const ctx = canvas.getContext('2d');
          if (ctx) {
            const { width, height } = canvas;
            const res = drawDetections(ctx, width, height);
            setStats({
              persons: res.persons,
              machines: res.machines,
              fps: Math.floor(Math.random() * 6) + 24 // 24-30 FPS
            });
          }
        }
      }, 2000);
    }
    return () => clearInterval(interval);
  }, [camera.status]);

  return (
    <Card className="bg-card border-border overflow-hidden relative group rounded-sm shadow-md flex flex-col h-full">
      <CardContent className="p-0 relative flex-1 bg-black flex flex-col cursor-pointer" onClick={onClick}>
        {/* Faux static noise background */}
        <div className="absolute inset-0 opacity-[0.05] pointer-events-none" 
            style={{ backgroundImage: 'url("data:image/svg+xml,%3Csvg viewBox=\'0 0 200 200\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cfilter id=\'noiseFilter\'%3E%3CfeTurbulence type=\'fractalNoise\' baseFrequency=\'0.8\' numOctaves=\'3\' stitchTiles=\'stitch\'/%3E%3C/filter%3E%3Crect width=\'100%25\' height=\'100%25\' filter=\'url(%23noiseFilter)\'/%3E%3C/svg%3E")' }} />
        
        {camera.status === 'offline' ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-black z-10">
             <Video className="w-12 h-12 text-muted-foreground/30 mb-2" />
             <span className="font-mono text-xs uppercase tracking-widest text-critical animate-pulse">Signal Lost</span>
          </div>
        ) : (
          <>
            <div className="absolute top-0 left-0 w-full h-1 bg-primary/20 shadow-[0_0_10px_rgba(var(--primary),0.5)] opacity-50 animate-[scan_4s_linear_infinite]" />
            <canvas ref={canvasRef} width={600} height={400} className="w-full h-full object-cover opacity-80" />
          </>
        )}

        {/* HUD Top */}
        <div className="absolute top-0 left-0 w-full p-3 flex justify-between items-start bg-gradient-to-b from-black/90 to-transparent pointer-events-none">
          <div className="flex flex-col">
            <span className="font-mono text-xs font-bold text-white shadow-black drop-shadow-md tracking-wider">{camera.name}</span>
            <span className="font-mono text-[9px] text-white/70 uppercase tracking-widest">Zone {camera.zone}</span>
          </div>
          <div className="flex items-center gap-2">
            {!isModal && (
              <div className="w-6 h-6 rounded bg-black/50 border border-white/10 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity pointer-events-auto hover:bg-white/10">
                 <Maximize2 className="w-3 h-3 text-white" />
              </div>
            )}
            <div className="flex items-center gap-1.5 bg-black/80 border border-white/10 px-2 py-0.5 rounded-sm">
              <div className={`w-1.5 h-1.5 rounded-full ${
                camera.status === 'online' ? 'bg-safe shadow-[0_0_8px_var(--color-safe)] animate-pulse' : 
                camera.status === 'alert' ? 'bg-critical shadow-[0_0_8px_var(--color-critical)] animate-pulse' : 
                'bg-muted'
              }`} />
              <span className="font-mono text-[9px] text-white uppercase">{camera.status}</span>
            </div>
          </div>
        </div>

        {/* HUD Bottom */}
        <div className="absolute bottom-0 left-0 w-full p-3 flex justify-between items-end bg-gradient-to-t from-black/90 to-transparent pointer-events-none">
          <div className="flex gap-3 font-mono text-[9px] text-white/80">
            {camera.status !== 'offline' && (
              <>
                <span className="text-worker drop-shadow-md">PER:{stats.persons}</span>
                <span className="text-machine drop-shadow-md">MAC:{stats.machines}</span>
                <span className="text-safe drop-shadow-md">PPE:OK</span>
              </>
            )}
          </div>
          <div className="flex flex-col items-end gap-1">
            <span className="font-mono text-[9px] text-white/50 tracking-widest">{stats.fps} FPS</span>
            <span className="font-mono text-[9px] text-primary animate-pulse tracking-widest">LIVE</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default function Cameras() {
  const { data: cameras, isLoading } = useListCameras();
  const [selectedCamera, setSelectedCamera] = useState<any>(null);

  return (
    <div className="space-y-6 fade-in-up">
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-mono font-bold tracking-tight text-foreground uppercase flex items-center gap-3">
            <Video className="w-8 h-8 text-primary" />
            CCTV Array
          </h1>
          <p className="text-sm font-mono text-muted-foreground mt-1 uppercase tracking-widest">Live Security & AI Feeds</p>
        </div>
        <div className="flex items-center gap-2 px-3 py-1.5 bg-card border border-border rounded-sm font-mono text-xs uppercase tracking-widest text-safe shadow-sm">
           <Activity className="w-3 h-3 animate-pulse" /> Global Recording Active
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 auto-rows-fr">
        {isLoading ? (
          [...Array(6)].map((_, i) => (
            <div key={i} className="aspect-video bg-card rounded-sm border border-border animate-pulse" />
          ))
        ) : cameras?.map((camera) => (
          <div key={camera.id} className="aspect-video">
            <CameraFeed camera={camera} onClick={() => setSelectedCamera(camera)} />
          </div>
        ))}
      </div>

      <Dialog open={!!selectedCamera} onOpenChange={(open) => !open && setSelectedCamera(null)}>
        <DialogContent className="max-w-5xl bg-black border-border p-0 gap-0 overflow-hidden" showClose={false}>
          {selectedCamera && (
            <div className="h-[70vh] relative">
               <CameraFeed camera={selectedCamera} isModal={true} />
               <DialogClose className="absolute top-4 right-4 z-50 w-8 h-8 bg-black/50 border border-white/10 rounded flex items-center justify-center hover:bg-white/10 transition-colors">
                  <X className="w-4 h-4 text-white" />
               </DialogClose>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <style dangerouslySetInnerHTML={{__html: `
        @keyframes scan {
          0% { top: -10%; }
          100% { top: 110%; }
        }
      `}} />
    </div>
  );
}
