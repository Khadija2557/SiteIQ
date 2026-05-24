"""
SiteIQ Object Tracker — DeepSORT simulation
Assigns persistent IDs to detected persons across frames and cameras.
Simulates cross-camera re-identification via position + appearance matching.
"""

import math
import time
from collections import deque
from dataclasses import dataclass, field
from typing import Optional


MAX_TRAJECTORY_LEN = 10
RE_ID_POSITION_THRESHOLD = 8.0
MAX_AGE_SECONDS = 30.0


@dataclass
class TrackedEntity:
    track_id: str
    worker_id: int
    name: str
    zone: str
    x: float
    y: float
    camera_id: int
    last_seen: float = field(default_factory=time.time)
    trajectory: deque = field(default_factory=lambda: deque(maxlen=MAX_TRAJECTORY_LEN))
    confidence: float = 0.95

    def update(self, x: float, y: float, camera_id: int, confidence: float, zone: str):
        self.trajectory.append({"x": self.x, "y": self.y, "t": self.last_seen})
        self.x = x
        self.y = y
        self.camera_id = camera_id
        self.confidence = confidence
        self.zone = zone
        self.last_seen = time.time()

    def is_stale(self) -> bool:
        return (time.time() - self.last_seen) > MAX_AGE_SECONDS

    def trajectory_list(self) -> list[dict]:
        return list(self.trajectory)

    def velocity(self) -> Optional[dict]:
        if len(self.trajectory) < 2:
            return None
        prev = self.trajectory[-1]
        dt = self.last_seen - prev["t"]
        if dt <= 0:
            return None
        return {
            "vx": round((self.x - prev["x"]) / dt, 3),
            "vy": round((self.y - prev["y"]) / dt, 3),
        }


class ObjectTracker:
    def __init__(self):
        self._tracks: dict[str, TrackedEntity] = {}
        self._next_id = 1

    def _make_id(self) -> str:
        tid = f"TRK-{self._next_id:04d}"
        self._next_id += 1
        return tid

    def _distance(self, x1, y1, x2, y2) -> float:
        return math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2)

    def _find_existing(self, worker_id: int, x: float, y: float, camera_id: int) -> Optional[TrackedEntity]:
        """
        Re-identification: match by worker_id first (same person, any camera).
        Fall back to position overlap across cameras (cross-camera re-id).
        """
        for track in self._tracks.values():
            if track.worker_id == worker_id:
                return track
        for track in self._tracks.values():
            if track.camera_id != camera_id:
                dist = self._distance(x, y, track.x, track.y)
                if dist < RE_ID_POSITION_THRESHOLD:
                    return track
        return None

    def update(self, detections: list[dict], camera_id: int) -> list[dict]:
        """
        Update tracker with new detections.
        Returns enriched detection list with track_id and trajectory.
        """
        self._prune_stale()
        enriched = []

        for det in detections:
            worker_id = det.get("id", 0)
            x = det.get("x", 0.0)
            y = det.get("y", 0.0)
            confidence = det.get("confidence", 0.9)
            zone = det.get("zone", "")

            existing = self._find_existing(worker_id, x, y, camera_id)
            if existing:
                existing.update(x, y, camera_id, confidence, zone)
                track_id = existing.track_id
                trajectory = existing.trajectory_list()
                velocity = existing.velocity()
            else:
                track_id = self._make_id()
                entity = TrackedEntity(
                    track_id=track_id,
                    worker_id=worker_id,
                    name=det.get("name", f"Worker-{worker_id}"),
                    zone=zone,
                    x=x,
                    y=y,
                    camera_id=camera_id,
                    confidence=confidence,
                )
                self._tracks[track_id] = entity
                trajectory = []
                velocity = None

            enriched.append({
                **det,
                "track_id": track_id,
                "trajectory": trajectory,
                "velocity": velocity,
            })

        return enriched

    def _prune_stale(self):
        stale = [tid for tid, t in self._tracks.items() if t.is_stale()]
        for tid in stale:
            del self._tracks[tid]

    def get_all_tracks(self) -> list[dict]:
        self._prune_stale()
        result = []
        for t in self._tracks.values():
            result.append({
                "track_id": t.track_id,
                "worker_id": t.worker_id,
                "name": t.name,
                "zone": t.zone,
                "x": round(t.x, 2),
                "y": round(t.y, 2),
                "camera_id": t.camera_id,
                "last_seen": t.last_seen,
                "trajectory": t.trajectory_list(),
                "velocity": t.velocity(),
                "confidence": t.confidence,
            })
        return result

    def get_track(self, track_id: str) -> Optional[dict]:
        t = self._tracks.get(track_id)
        if not t:
            return None
        return {
            "track_id": t.track_id,
            "worker_id": t.worker_id,
            "name": t.name,
            "zone": t.zone,
            "x": round(t.x, 2),
            "y": round(t.y, 2),
            "camera_id": t.camera_id,
            "last_seen": t.last_seen,
            "trajectory": t.trajectory_list(),
            "velocity": t.velocity(),
            "confidence": t.confidence,
        }
