import random
from enum import Enum
from math import radians, sin, cos, sqrt, atan2

from models import POI, POITracker, TouristProfile
from scoring import ScoringStrategy, ScoringFactory



class AgentState(Enum):
    IDLE       = "idle"
    TRAVELLING = "travelling"
    VISITING   = "visiting"
    RESTING    = "resting"
    DONE       = "done"


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
    def __init__(
        self,
        agent_id: int,
        profile: TouristProfile,
        pois: list[POI],
        tracker: POITracker | None = None,
        strategy: ScoringStrategy | str = "interests",
    ):
        self.agent_id = agent_id
        self.profile  = profile
        self.pois     = pois
        self.tracker  = tracker
        self.state    = AgentState.IDLE

        # Resolve strategy — accept either an instance or a name string
        if isinstance(strategy, str):
            self.strategy: ScoringStrategy = ScoringFactory.get_strategy(strategy)
            self.strategy_name: str = strategy
        else:
            self.strategy = strategy
            self.strategy_name = type(strategy).__name__

        self.current_time: float = 9.0
        self.current_location: POI | None = None
        self.visited: list[tuple[POI, float]] = []  # (poi, arrival_time)

        self.fatigue: float      = 0.0
        self.satisfaction: float = 0.0
        self.money_spent: float  = 0.0
        self.events: list[str]   = []

    # Main step

    def step(self) -> bool:
        """Advance one decision step. Returns True if still active."""
        if self.state == AgentState.DONE:
            return False

        end_time = 9.0 + self.profile.available_hours

        # Stop conditions
        if self.current_time >= end_time:
            self._log("Day over — heading back to hotel.")
            self.state = AgentState.DONE
            return False

        if self.fatigue >= 1.0:
            self._log("Completely exhausted — calling it a day.")
            self.state = AgentState.DONE
            return False

        # Rest if fatigued 
        if self.fatigue > 0.7:
            rest = 0.5
            self._log(f"Taking a {rest*60:.0f}-min rest at {self.current_time:.1f}h")
            self.current_time += rest
            self.fatigue = max(0.0, self.fatigue - 0.3)
            self.state = AgentState.RESTING
            return True

        #  Choose and visit next POI 
        next_poi = self._choose_next_poi()
        if next_poi is None:
            self._log("No more suitable POIs — finishing early.")
            self.state = AgentState.DONE
            return False

        travel_h    = self._travel_time(next_poi)
        fatigue_inc = self._fatigue_cost(next_poi, travel_h)  # compute once

        self.current_time += travel_h
        arrival            = self.current_time
        self.current_time += next_poi.avg_visit_duration_hours

        cost               = next_poi.entry_price_eur
        self.money_spent  += cost
        self.fatigue       = min(1.0, self.fatigue + fatigue_inc)
        gain               = self.strategy.score(self.profile, next_poi, self.tracker)  # pass tracker for live crowd info
        self.satisfaction += gain

        self.visited.append((next_poi, arrival))
        if self.tracker:
            self.tracker.record(next_poi, self.agent_id, arrival)
        self.current_location = next_poi
        self.state = AgentState.VISITING

        self._log(
            f"{arrival:.1f}h → visited '{next_poi.name}' "
            f"(€{cost:.0f}, fatigue +{fatigue_inc:.2f}, satisfaction +{gain:.2f})"
        )
        return True

    #  POI selection 

    def _choose_next_poi(self) -> POI | None:
        visited_ids = {p.id for p, _ in self.visited}
        candidates  = [p for p in self.pois if p.id not in visited_ids]

        # Filter by time remaining
        end_time   = 9.0 + self.profile.available_hours
        candidates = [
            p for p in candidates
            if (self.current_time + self._travel_time(p) + p.avg_visit_duration_hours)
               <= end_time + 0.5   # 30-min grace
        ]

        # Filter out paid POIs when budget is exhausted
        if self.money_spent >= self.profile.daily_budget_eur:
            candidates = [p for p in candidates if p.entry_price_eur == 0.0]

        # Filter by max walking distance (walking-only tourists)
        if self.profile.mobility_mode == "walking":
            candidates = [
                p for p in candidates
                if self._distance_km(p) <= self.profile.max_walking_distance_km
            ]

        if not candidates:
            return None

        # Score using the agent's assigned strategy, minus a small travel penalty
        scored = [
            (p, self.strategy.score(self.profile, p, self.tracker) - self._travel_time(p) * 0.1)
            for p in candidates
        ]
        scores = [max(s, 0.0) for _, s in scored]
        total  = sum(scores)

        if total == 0:
            return random.choice(candidates)

        # Softmax-style weighted sampling — probabilistic, not purely greedy
        r, cumulative = random.random() * total, 0.0
        for poi, score in scored:
            cumulative += max(score, 0.0)
            if cumulative >= r:
                return poi
        return scored[-1][0]

    # Helpers 

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


    def summary(self) -> dict:
        return {
            "agent_id":      self.agent_id,
            "strategy":      self.strategy_name,   # ← new: labels output CSVs
            "nationality":   self.profile.nationality,
            "pois_visited":  len(self.visited),
            "money_spent":   round(self.money_spent, 2),
            "fatigue":       round(self.fatigue, 3),
            "satisfaction":  round(self.satisfaction, 3),
            "hours_used":    round(self.current_time - 9.0, 2),
            "itinerary":     [p.name for p, _ in self.visited],
        }