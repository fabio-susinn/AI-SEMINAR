import random

from models import TouristProfile, POI, POITracker
from .scoring import match_score

from enum import Enum
from math import radians, sin, cos, sqrt, atan2


class AgentState(Enum):
    IDLE       = "idle" #start state
    TRAVELLING = "travelling"
    VISITING   = "visiting"
    RESTING    = "resting"
    DONE       = "done" #final state


SPEED_KMH = {
    "walking":          4,
    "bike":            12,
    "public_transport": 20,
    "car":             30,
    "mixed":           10,
}


def haversine_km(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    R = 6371.0
    dlat = radians(lat2 - lat1)
    dlng = radians(lng2 - lng1)
    a = sin(dlat / 2) ** 2 + cos(radians(lat1)) * cos(radians(lat2)) * sin(dlng / 2) ** 2
    return R * 2 * atan2(sqrt(a), sqrt(1 - a))


class TouristAgent:
    def __init__(self, agent_id: int, profile: TouristProfile, pois: list, tracker: POITracker = None):
        self.agent_id = agent_id
        self.profile = profile
        self.pois = pois
        self.state = AgentState.IDLE
        self.tracker = tracker

        self.current_time = 9.0          # start at 9am
        self.current_location: POI | None = None
        self.visited: list[tuple[POI, float]] = []   # (poi, arrival_time)

        self.fatigue = 0.0
        self.satisfaction = 0.0
        self.money_spent = 0.0
        self.events: list[str] = []      # narrative log

    # ── Main step ─────────────────────────────────────────────────────────────

    def step(self) -> bool:
        """Advance one decision step. Returns True if still active."""
        if self.state == AgentState.DONE:
            return False

        end_time = 9.0 + self.profile.available_hours

        # ── Stop conditions ───────────────────────────────────────────────────
        if self.current_time >= end_time:
            self._log("Day over — heading back to hotel.")
            self.state = AgentState.DONE
            return False

        if self.fatigue >= 1.0:
            self._log("Completely exhausted — calling it a day.")
            self.state = AgentState.DONE
            return False

        if self.money_spent >= self.profile.daily_budget_eur:
            self._log("Budget exhausted — no more paid attractions.")

        # ── Rest if fatigued ──────────────────────────────────────────────────
        if self.fatigue > 0.7:
            rest = 0.5
            self._log(f"Taking a {rest*60:.0f}-min rest at {self.current_time:.1f}h")
            self.current_time += rest
            self.fatigue = max(0.0, self.fatigue - 0.3)
            self.state = AgentState.RESTING
            return True

        # ── Choose and visit next POI ─────────────────────────────────────────
        next_poi = self._choose_next_poi()
        if next_poi is None:
            self._log("No more suitable POIs — finishing early.")
            self.state = AgentState.DONE
            return False

        travel_h = self._travel_time(next_poi)
        self.current_time += travel_h
        arrival = self.current_time
        self.current_time += next_poi.avg_visit_duration_hours

        cost = next_poi.entry_price_eur
        self.money_spent  += cost
        self.fatigue      += self._fatigue_cost(next_poi, travel_h)
        self.fatigue       = min(self.fatigue, 1.0)
        gain               = match_score(next_poi, self.profile)
        self.satisfaction += gain

        self.visited.append((next_poi, arrival))
        if self.tracker:
            self.tracker.record(next_poi, self.agent_id, arrival)
        self.current_location = next_poi
        self.state = AgentState.VISITING

        self._log(
            f"{arrival:.1f}h → visited '{next_poi.name}' "
            f"(€{cost:.0f}, fatigue +{self._fatigue_cost(next_poi, travel_h):.2f}, "
            f"satisfaction +{gain:.2f})"
        )
        return True

    # ── POI selection ─────────────────────────────────────────────────────────

    def _choose_next_poi(self) -> POI | None:
        visited_ids = {p.id for p, _ in self.visited}
        candidates = [p for p in self.pois if p.id not in visited_ids]

        # Filter by time remaining
        end_time = 9.0 + self.profile.available_hours
        candidates = [
            p for p in candidates
            if (self.current_time + self._travel_time(p) + p.avg_visit_duration_hours)
               <= end_time + 0.5   # 30-min grace
        ]

        # Filter by max walking distance
        if self.profile.mobility_mode == "walking":
            candidates = [
                p for p in candidates
                if self._distance_km(p) <= self.profile.max_walking_distance_km
            ]

        if not candidates:
            return None

        # Score + softmax sampling (realistic, not purely greedy)
        scored = [(p, match_score(p, self.profile) - self._travel_time(p) * 0.1)
                  for p in candidates]
        scores = [max(s, 0.0) for _, s in scored]
        total = sum(scores)

        if total == 0:
            return random.choice(candidates)

        r = random.random() * total
        cumulative = 0.0
        for poi, score in scored:
            cumulative += max(score, 0.0)
            if cumulative >= r:
                return poi
        return scored[-1][0]

    # ── Helpers ───────────────────────────────────────────────────────────────

    def _travel_time(self, poi: POI) -> float:
        if self.current_location is None:
            return 0.0
        dist = haversine_km(
            self.current_location.lat, self.current_location.lng,
            poi.lat, poi.lng,
        )
        return dist / SPEED_KMH[self.profile.mobility_mode]

    def _distance_km(self, poi: POI) -> float:
        if self.current_location is None:
            return 0.0
        return haversine_km(
            self.current_location.lat, self.current_location.lng,
            poi.lat, poi.lng,
        )

    def _fatigue_cost(self, poi: POI, travel_h: float) -> float:
        base       = poi.avg_visit_duration_hours * 0.08
        walk_cost  = travel_h * {
            "walking": 0.15, "bike": 0.08,
            "public_transport": 0.04, "car": 0.02, "mixed": 0.07,
        }[self.profile.mobility_mode]
        crowd_cost = poi.avg_crowd_level * self.profile.crowd_aversion * 0.1
        return base + walk_cost + crowd_cost

    def _log(self, msg: str):
        self.events.append(msg)

    # ── Summary ───────────────────────────────────────────────────────────────

    def summary(self) -> dict:
        return {
            "agent_id":      self.agent_id,
            "nationality":   self.profile.nationality,
            "pois_visited":  len(self.visited),
            "money_spent":   round(self.money_spent, 2),
            "fatigue":       round(self.fatigue, 3),
            "satisfaction":  round(self.satisfaction, 3),
            "hours_used":    round(self.current_time - 9.0, 2),
            "itinerary":     [p.name for p, _ in self.visited],
        }
