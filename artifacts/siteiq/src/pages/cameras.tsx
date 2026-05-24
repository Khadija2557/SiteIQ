import { useListCameras } from "@workspace/api-client-react";
import { Card, CardContent } from "@/components/ui/card";
import { Video, Activity } from "lucide-react";

export default function Cameras() {
  const { data: cameras, isLoading } = useListCameras();

  return (
    <div className="space-y-6 fade-in-up">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-mono font-bold tracking-tight text-foreground uppercase flex items-center gap-3">
            <Video className="w-8 h-8 text-primary" />
            CCTV Network
          </h1>
          <p className="text-sm font-mono text-muted-foreground mt-1 uppercase tracking-widest">Live Security Feeds</p>
        </div>
        <div className="flex items-center gap-2 px-3 py-1.5 bg-card/40 border border-border rounded font-mono text-xs uppercase text-safe">
           <Activity className="w-3 h-3 animate-pulse" /> Recording
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {isLoading ? (
          [...Array(6)].map((_, i) => (
            <div key={i} className="aspect-video bg-card/40 rounded-xl border border-border animate-pulse" />
          ))
        ) : cameras?.map((camera) => (
          <Card key={camera.id} className="bg-black border-border overflow-hidden relative group">
            <CardContent className="p-0 aspect-video relative flex items-center justify-center bg-zinc-900">
               {/* Faux static noise effect */}
               <div className="absolute inset-0 opacity-[0.03] pointer-events-none" 
                    style={{ backgroundImage: 'url("data:image/svg+xml,%3Csvg viewBox=\'0 0 200 200\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cfilter id=\'noiseFilter\'%3E%3CfeTurbulence type=\'fractalNoise\' baseFrequency=\'0.65\' numOctaves=\'3\' stitchTiles=\'stitch\'/%3E%3C/filter%3E%3Crect width=\'100%25\' height=\'100%25\' filter=\'url(%23noiseFilter)\'/%3E%3C/svg%3E")' }} />
               
               {/* Scanning line */}
               <div className="absolute top-0 left-0 w-full h-1 bg-primary/20 shadow-[0_0_10px_rgba(var(--primary),0.5)] opacity-50 animate-[scan_3s_linear_infinite]" />
               
               <Video className="w-12 h-12 text-muted-foreground/20" />
               
               {/* Overlay info */}
               <div className="absolute top-0 left-0 w-full p-3 flex justify-between items-start bg-gradient-to-b from-black/80 to-transparent">
                  <div className="flex flex-col">
                     <span className="font-mono text-xs font-bold text-white shadow-black drop-shadow-md">{camera.name}</span>
                     <span className="font-mono text-[10px] text-white/70 uppercase">Zone {camera.zone}</span>
                  </div>
                  <div className="flex items-center gap-1.5 bg-black/50 px-2 py-0.5 rounded backdrop-blur">
                     <div className={`w-1.5 h-1.5 rounded-full ${camera.status === 'online' ? 'bg-safe shadow-[0_0_5px_var(--color-safe)] animate-pulse' : 'bg-critical'}`} />
                     <span className="font-mono text-[9px] text-white uppercase">{camera.status}</span>
                  </div>
               </div>
               
               <div className="absolute bottom-0 left-0 w-full p-3 flex justify-between items-end bg-gradient-to-t from-black/80 to-transparent">
                  <span className="font-mono text-[10px] text-white/70 shadow-black drop-shadow-md">
                    {camera.lastFrameAt ? new Date(camera.lastFrameAt).toLocaleTimeString() : '--:--:--'}
                  </span>
                  <span className="font-mono text-[10px] text-white/50 tracking-widest">REC</span>
               </div>
            </CardContent>
          </Card>
        ))}
      </div>
      <style dangerouslySetInnerHTML={{__html: `
        @keyframes scan {
          0% { top: 0; }
          100% { top: 100%; }
        }
      `}} />
    </div>
  );
}
