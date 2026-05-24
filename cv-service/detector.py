"""
SiteIQ Computer Vision Detection Simulation Engine
Simulates realistic CV detection events for construction site monitoring.
"""

import random
import math
import time
from typing import Optional
from dataclasses import dataclass, field


ZONES = {
    "Zone A": {"x_range": (0, 25),  "y_range": (25, 50), "heat_risk": False},
    "Zone B": {"x_range": (25, 55), "y_range": (15, 45), "heat_risk": True},
    "Zone C": {"x_range": (55, 85), "y_range": (5, 30),  "heat_risk": False},
    "Zone D": {"x_range": (75, 100),"y_range": (35, 55), "heat_risk": True},
}

CRANE_SWING_RADIUS = 20.0
PROXIMITY_THRESHOLD = 5.0
HEAT_WARNING_HOURS = 3.0
HEAT_CRITICAL_HOURS = 4.0


@dataclass
class SimulatedWorker:
    id: int
    name: str
    zone: str
    x: float
    y: float
    has_hardhat: bool = True
    has_vest: bool = True
    has_gloves: bool = True
    zone_entry_time: float = field(default_factory=time.time)
    ppe_check_cooldown: float = 0.0
    track_id: Optional[str] = None

    def drift(self):
        zone = ZONES[self.zone]
        dx = random.uniform(-1.5, 1.5)
        dy = random.uniform(-1.5, 1.5)
        self.x = max(zone["x_range"][0], min(zone["x_range"][1], self.x + dx))
        self.y = max(zone["y_range"][0], min(zone["y_range"][1], self.y + dy))

    def time_in_zone_hours(self) -> float:
        return (time.time() - self.zone_entry_time) / 3600.0


@dataclass
class SimulatedMachine:
    id: int
    name: str
    machine_type: str
    zone: str
    x: float
    y: float
    operating: bool = True
    utilization: int = 0


class SiteIQDetector:
    def __init__(self):
        self.workers: list[SimulatedWorker] = self._init_workers()
        self.machines: list[SimulatedMachine] = self._init_machines()
        self.frame_count = 0
        self.last_heat_check: dict[int, float] = {}

    def _init_workers(self) -> list[SimulatedWorker]:
        return [
            SimulatedWorker(id=1,  name="Jake Morrison",     zone="Zone A", x=12.5, y=34.2),
            SimulatedWorker(id=2,  name="Maria Santos",      zone="Zone A", x=15.1, y=31.7),
            SimulatedWorker(id=3,  name="Tom Bridges",       zone="Zone A", x=18.3, y=29.4),
            SimulatedWorker(id=4,  name="Priya Nair",        zone="Zone B", x=42.0, y=22.5),
            SimulatedWorker(id=5,  name="Carlos Diaz",       zone="Zone B", x=45.6, y=25.3),
            SimulatedWorker(id=6,  name="Aisha Kamara",      zone="Zone B", x=48.2, y=20.1),
            SimulatedWorker(id=7,  name="Derek Okafor",      zone="Zone C", x=72.4, y=15.6),
            SimulatedWorker(id=8,  name="Linda Zhao",        zone="Zone C", x=69.8, y=18.9),
            SimulatedWorker(id=9,  name="Sam Patel",         zone="Zone C", x=75.3, y=12.2),
            SimulatedWorker(id=10, name="Brent Nakamura",    zone="Zone D", x=91.5, y=45.7),
            SimulatedWorker(id=11, name="Fatima Al-Rashid",  zone="Zone D", x=88.2, y=48.3),
            SimulatedWorker(id=12, name="Owen Fitzgerald",   zone="Zone D", x=95.1, y=41.9),
        ]

    def _init_machines(self) -> list[SimulatedMachine]:
        return [
            SimulatedMachine(id=1, name="Crane Alpha",  machine_type="crane",    zone="Zone A", x=14.0, y=35.0, operating=True,  utilization=85),
            SimulatedMachine(id=2, name="Crane Beta",   machine_type="crane",    zone="Zone B", x=44.0, y=24.0, operating=False, utilization=0),
            SimulatedMachine(id=3, name="Forklift F1",  machine_type="forklift", zone="Zone B", x=47.0, y=26.0, operating=True,  utilization=72),
            SimulatedMachine(id=4, name="Forklift F2",  machine_type="forklift", zone="Zone C", x=71.0, y=16.0, operating=False, utilization=0),
            SimulatedMachine(id=5, name="Excavator X1", machine_type="excavator",zone="Zone D", x=90.0, y=47.0, operating=True,  utilization=90),
            SimulatedMachine(id=6, name="Mixer M1",     machine_type="mixer",    zone="Zone C", x=74.0, y=13.0, operating=False, utilization=0),
        ]

    def _distance(self, x1, y1, x2, y2) -> float:
        return math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2)

    def _roll_ppe(self, worker: SimulatedWorker) -> dict:
        """
        PPE violation probabilities:
        - 15% chance missing hardhat
        - 10% chance missing vest
        - 5% chance missing both
        """
        roll = random.random()
        if roll < 0.05:
            return {"has_hardhat": False, "has_vest": False, "has_gloves": True}
        elif roll < 0.15:
            return {"has_hardhat": False, "has_vest": True, "has_gloves": True}
        elif roll < 0.25:
            return {"has_hardhat": True, "has_vest": False, "has_gloves": True}
        else:
            return {"has_hardhat": True, "has_vest": True, "has_gloves": True}

    def generate_frame(self, camera_id: int) -> dict:
        """Generate a complete detection frame for a given camera."""
        self.frame_count += 1
        now = time.time()

        # Drift worker positions
        for worker in self.workers:
            worker.drift()

        # Which workers are visible from this camera (split cameras across zones)
        camera_zone_map = {
            1: "Zone A", 2: "Zone A",
            3: "Zone B", 4: "Zone B",
            5: "Zone C", 6: "Zone D",
        }
        visible_zone = camera_zone_map.get(camera_id, "Zone A")
        visible_workers = [w for w in self.workers if w.zone == visible_zone]
        visible_machines = [m for m in self.machines if m.zone == visible_zone]

        person_detections = []
        hazard_detections = []
        events = []

        for worker in visible_workers:
            ppe = self._roll_ppe(worker)
            confidence = round(random.uniform(0.85, 0.99), 3)

            person_detections.append({
                "id": worker.id,
                "name": worker.name,
                "x": round(worker.x, 2),
                "y": round(worker.y, 2),
                "confidence": confidence,
                "has_hardhat": ppe["has_hardhat"],
                "has_vest": ppe["has_vest"],
                "has_gloves": ppe["has_gloves"],
                "zone": worker.zone,
                "track_id": f"TRK-{worker.id:03d}",
            })

            # PPE violation event
            if not ppe["has_hardhat"] or not ppe["has_vest"]:
                missing = []
                if not ppe["has_hardhat"]:
                    missing.append("hard hat")
                if not ppe["has_vest"]:
                    missing.append("safety vest")
                events.append({
                    "event_type": "ppe_violation",
                    "camera_id": camera_id,
                    "worker_id": worker.id,
                    "confidence": confidence,
                    "bbox": {"x": round(worker.x, 2), "y": round(worker.y, 2), "w": 1.8, "h": 1.9},
                    "detail": f"{worker.name} missing: {', '.join(missing)}",
                    "zone": worker.zone,
                })

        # Machine detections
        machine_detections = []
        for machine in visible_machines:
            machine_detections.append({
                "id": machine.id,
                "name": machine.name,
                "type": machine.machine_type,
                "x": round(machine.x, 2),
                "y": round(machine.y, 2),
                "confidence": round(random.uniform(0.90, 0.99), 3),
                "operating": machine.operating,
                "utilization": machine.utilization,
            })

        # Proximity detection
        for worker in visible_workers:
            for machine in visible_machines:
                if not machine.operating:
                    continue
                dist = self._distance(worker.x, worker.y, machine.x, machine.y)
                if dist < PROXIMITY_THRESHOLD:
                    confidence = round(random.uniform(0.75, 0.95), 3)
                    hazard_detections.append({
                        "type": "proximity",
                        "confidence": confidence,
                        "location": {"x": round(worker.x, 2), "y": round(worker.y, 2)},
                        "detail": f"{worker.name} within {dist:.1f}m of {machine.name}",
                    })
                    events.append({
                        "event_type": "proximity_breach",
                        "camera_id": camera_id,
                        "worker_id": worker.id,
                        "confidence": confidence,
                        "bbox": {"x": round(worker.x, 2), "y": round(worker.y, 2), "w": 2.0, "h": 2.0},
                        "detail": f"Proximity breach: {worker.name} {dist:.1f}m from {machine.name}",
                        "zone": worker.zone,
                    })

        # Crane swing zone detection
        for machine in visible_machines:
            if machine.machine_type != "crane" or not machine.operating:
                continue
            workers_in_swing = [
                w for w in visible_workers
                if self._distance(w.x, w.y, machine.x, machine.y) < CRANE_SWING_RADIUS
            ]
            if len(workers_in_swing) >= 2:
                confidence = round(random.uniform(0.80, 0.95), 3)
                hazard_detections.append({
                    "type": "swing_zone",
                    "confidence": confidence,
                    "location": {"x": machine.x, "y": machine.y},
                    "detail": f"{len(workers_in_swing)} workers in swing zone of {machine.name}",
                })
                events.append({
                    "event_type": "swing_zone_breach",
                    "camera_id": camera_id,
                    "worker_id": workers_in_swing[0].id,
                    "confidence": confidence,
                    "bbox": {"x": machine.x, "y": machine.y, "w": CRANE_SWING_RADIUS * 2, "h": CRANE_SWING_RADIUS * 2},
                    "detail": f"{len(workers_in_swing)} workers in swing zone of {machine.name}",
                    "zone": machine.zone,
                })

        # Heat exposure tracking
        heat_zone_names = [z for z, cfg in ZONES.items() if cfg["heat_risk"]]
        for worker in visible_workers:
            if worker.zone not in heat_zone_names:
                continue
            hours = worker.time_in_zone_hours()
            last_check = self.last_heat_check.get(worker.id, 0)
            if hours >= HEAT_CRITICAL_HOURS and (now - last_check) > 300:
                events.append({
                    "event_type": "heat_exposure",
                    "camera_id": camera_id,
                    "worker_id": worker.id,
                    "confidence": 0.92,
                    "bbox": {"x": round(worker.x, 2), "y": round(worker.y, 2), "w": 1.5, "h": 1.8},
                    "detail": f"CRITICAL: {worker.name} in heat zone {worker.zone} for {hours:.1f}h",
                    "zone": worker.zone,
                })
                self.last_heat_check[worker.id] = now
            elif hours >= HEAT_WARNING_HOURS and (now - last_check) > 600:
                events.append({
                    "event_type": "heat_exposure",
                    "camera_id": camera_id,
                    "worker_id": worker.id,
                    "confidence": 0.85,
                    "bbox": {"x": round(worker.x, 2), "y": round(worker.y, 2), "w": 1.5, "h": 1.8},
                    "detail": f"Warning: {worker.name} in heat zone {worker.zone} for {hours:.1f}h",
                    "zone": worker.zone,
                })
                self.last_heat_check[worker.id] = now

        # Occasional random hazard (smoke / unknown object)
        if random.random() < 0.03 and visible_workers:
            w = random.choice(visible_workers)
            hazard_detections.append({
                "type": "heat",
                "confidence": round(random.uniform(0.60, 0.80), 3),
                "location": {"x": round(w.x + 2, 2), "y": round(w.y + 2, 2)},
                "detail": "Heat signature anomaly detected near worker cluster",
            })

        return {
            "camera_id": camera_id,
            "frame_id": self.frame_count,
            "timestamp": now,
            "zone": visible_zone,
            "person_detections": person_detections,
            "machine_detections": machine_detections,
            "hazard_detections": hazard_detections,
            "events": events,
        }

    def get_worker_states(self) -> list[dict]:
        return [
            {
                "id": w.id, "name": w.name, "zone": w.zone,
                "x": round(w.x, 2), "y": round(w.y, 2),
                "time_in_zone_hours": round(w.time_in_zone_hours(), 2),
            }
            for w in self.workers
        ]
