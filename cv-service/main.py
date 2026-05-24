"""
SiteIQ Computer Vision Microservice
FastAPI application that simulates real-time CV detection events.
"""

import asyncio
import json
import os
import time
import threading
import logging
from typing import AsyncGenerator

import requests
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

from detector import SiteIQDetector
from tracker import ObjectTracker

load_dotenv()

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [CV-SERVICE] %(levelname)s %(message)s",
    datefmt="%H:%M:%S",
)
log = logging.getLogger("siteiq-cv")

API_BASE = os.getenv("API_BASE_URL", "http://localhost:8080")
INTERNAL_KEY = os.getenv("CV_INTERNAL_KEY", "cv-internal-key-siteiq")
SIMULATION_INTERVAL = float(os.getenv("SIMULATION_INTERVAL_SEC", "3"))
TENANT_ID = int(os.getenv("TENANT_ID", "1"))

app = FastAPI(title="SiteIQ CV Service", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

detector = SiteIQDetector()
tracker = ObjectTracker()

_registered_cameras: list[dict] = [
    {"id": 1, "name": "CAM-01 Zone A Entry",     "zone": "Zone A", "status": "simulating"},
    {"id": 2, "name": "CAM-02 Crane Alpha",       "zone": "Zone A", "status": "simulating"},
    {"id": 3, "name": "CAM-03 Zone B Overview",   "zone": "Zone B", "status": "simulating"},
    {"id": 4, "name": "CAM-04 Forklift Bay",      "zone": "Zone B", "status": "simulating"},
    {"id": 5, "name": "CAM-05 Zone C Scaffold",   "zone": "Zone C", "status": "simulating"},
    {"id": 6, "name": "CAM-06 Zone D Excavation", "zone": "Zone D", "status": "simulating"},
]

_active_simulations: set[int] = set()
_event_queue: asyncio.Queue = asyncio.Queue(maxsize=500)
_stats = {"frames_processed": 0, "events_sent": 0, "errors": 0, "started_at": time.time()}


# ─── Request / Response Models ───────────────────────────────────────────────

class DetectRequest(BaseModel):
    camera_id: int
    frame_data: str = ""

class RegisterCameraRequest(BaseModel):
    name: str
    rtsp_url: str
    zone: str

class SimulateStartRequest(BaseModel):
    camera_id: int


# ─── Internal publisher ───────────────────────────────────────────────────────

def publish_event(event: dict) -> bool:
    """POST a detection event to the Node.js backend internal endpoint."""
    try:
        resp = requests.post(
            f"{API_BASE}/api/internal/cv-events",
            json={**event, "tenant_id": TENANT_ID},
            headers={"X-CV-Service-Key": INTERNAL_KEY},
            timeout=4,
        )
        if resp.status_code in (200, 201):
            _stats["events_sent"] += 1
            return True
        log.warning("Backend rejected event %s: %d %s", event.get("event_type"), resp.status_code, resp.text[:120])
        return False
    except Exception as exc:
        _stats["errors"] += 1
        log.error("Failed to publish event: %s", exc)
        return False


def _push_to_queue(frame: dict):
    try:
        _event_queue.put_nowait(frame)
    except asyncio.QueueFull:
        try:
            _event_queue.get_nowait()
            _event_queue.put_nowait(frame)
        except Exception:
            pass


# ─── Simulation runner ────────────────────────────────────────────────────────

def _run_simulation_loop():
    """Background thread: generates frames every SIMULATION_INTERVAL seconds."""
    log.info("Simulation loop started — interval=%.1fs cameras=%d", SIMULATION_INTERVAL, len(_registered_cameras))
    while True:
        try:
            for cam in _registered_cameras:
                cam_id = cam["id"]
                frame = detector.generate_frame(cam_id)
                _stats["frames_processed"] += 1

                # Enrich person detections with tracker
                frame["person_detections"] = tracker.update(
                    frame["person_detections"], cam_id
                )

                # Push to SSE queue
                _push_to_queue(frame)

                # Publish each event to the Node.js backend
                for event in frame.get("events", []):
                    published = publish_event(event)
                    status = "OK" if published else "FAIL"
                    log.info(
                        "[CAM-%d] %s | worker=%s | conf=%.2f | %s",
                        cam_id,
                        event["event_type"].upper(),
                        event.get("worker_id", "-"),
                        event.get("confidence", 0),
                        status,
                    )

                if frame["events"]:
                    log.info(
                        "[CAM-%d] frame=%d persons=%d machines=%d hazards=%d events=%d",
                        cam_id, frame["frame_id"],
                        len(frame["person_detections"]),
                        len(frame["machine_detections"]),
                        len(frame["hazard_detections"]),
                        len(frame["events"]),
                    )

        except Exception as exc:
            _stats["errors"] += 1
            log.exception("Simulation loop error: %s", exc)

        time.sleep(SIMULATION_INTERVAL)


_sim_thread = threading.Thread(target=_run_simulation_loop, daemon=True)


# ─── App lifecycle ────────────────────────────────────────────────────────────

@app.on_event("startup")
def on_startup():
    for cam in _registered_cameras:
        _active_simulations.add(cam["id"])
    _sim_thread.start()
    log.info("SiteIQ CV Service started — %d cameras in simulation mode", len(_registered_cameras))


# ─── Endpoints ────────────────────────────────────────────────────────────────

@app.get("/health")
def health():
    uptime = round(time.time() - _stats["started_at"], 1)
    return {
        "status": "ok",
        "service": "SiteIQ CV Microservice",
        "uptime_seconds": uptime,
        "model_status": "simulation",
        "cameras_registered": len(_registered_cameras),
        "active_simulations": len(_active_simulations),
        "stats": _stats,
        "tracker_tracks": len(tracker.get_all_tracks()),
    }


@app.get("/cameras")
def list_cameras():
    return {"cameras": _registered_cameras}


@app.post("/cameras/register")
def register_camera(body: RegisterCameraRequest):
    new_id = max((c["id"] for c in _registered_cameras), default=0) + 1
    cam = {
        "id": new_id,
        "name": body.name,
        "rtsp_url": body.rtsp_url,
        "zone": body.zone,
        "status": "registered",
    }
    _registered_cameras.append(cam)
    log.info("Camera registered: id=%d name=%s zone=%s", new_id, body.name, body.zone)
    return cam


@app.post("/detect")
def detect(body: DetectRequest):
    """Run detection pipeline on a frame (simulation mode ignores frame_data)."""
    cam_ids = [c["id"] for c in _registered_cameras]
    if body.camera_id not in cam_ids:
        raise HTTPException(status_code=404, detail=f"Camera {body.camera_id} not registered")

    frame = detector.generate_frame(body.camera_id)
    frame["person_detections"] = tracker.update(frame["person_detections"], body.camera_id)
    _stats["frames_processed"] += 1

    for event in frame.get("events", []):
        publish_event(event)

    return {
        "camera_id": body.camera_id,
        "frame_id": frame["frame_id"],
        "detections": {
            "persons": frame["person_detections"],
            "machines": frame["machine_detections"],
            "hazards": frame["hazard_detections"],
        },
        "events_fired": len(frame["events"]),
        "events": frame["events"],
    }


@app.post("/simulate/start")
def simulate_start(body: SimulateStartRequest):
    cam_ids = [c["id"] for c in _registered_cameras]
    if body.camera_id not in cam_ids:
        raise HTTPException(status_code=404, detail=f"Camera {body.camera_id} not registered")
    _active_simulations.add(body.camera_id)
    for cam in _registered_cameras:
        if cam["id"] == body.camera_id:
            cam["status"] = "simulating"
    return {"camera_id": body.camera_id, "simulation": "started"}


@app.get("/tracker/tracks")
def get_tracks():
    return {"tracks": tracker.get_all_tracks()}


@app.get("/workers/states")
def worker_states():
    return {"workers": detector.get_worker_states()}


@app.get("/events/stream")
async def events_stream():
    """Server-Sent Events stream of real-time detections."""

    async def generate() -> AsyncGenerator[str, None]:
        yield "data: {\"connected\": true, \"service\": \"SiteIQ CV\"}\n\n"
        last_heartbeat = time.time()
        while True:
            try:
                frame = await asyncio.wait_for(_event_queue.get(), timeout=5.0)
                payload = json.dumps({
                    "camera_id": frame["camera_id"],
                    "frame_id": frame["frame_id"],
                    "zone": frame["zone"],
                    "timestamp": frame["timestamp"],
                    "person_count": len(frame["person_detections"]),
                    "events": frame["events"],
                    "hazards": frame["hazard_detections"],
                })
                yield f"data: {payload}\n\n"
            except asyncio.TimeoutError:
                if time.time() - last_heartbeat > 15:
                    yield "data: {\"heartbeat\": true}\n\n"
                    last_heartbeat = time.time()
            except Exception:
                break

    return StreamingResponse(
        generate(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
            "Connection": "keep-alive",
        },
    )


if __name__ == "__main__":
    import uvicorn
    port = int(os.getenv("CV_PORT", "9000"))
    uvicorn.run("main:app", host="0.0.0.0", port=port, reload=False)
