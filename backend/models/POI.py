from pydantic import BaseModel, Field, computed_field
from typing import List, Literal, Optional

class POI(BaseModel):
    id: str
    name: str
    description: Optional[str] = None

    lat: float
    lng: float
    district: Optional[str] = None
    address: Optional[str] = None

    category: Literal[
        "museum",
        "monument",
        "park",
        "beach",
        "market",
        "restaurant",
        "bar",
        "nightlife",
        "shop",
        "viewpoint",
        "religious",
        "architecture",
        "neighbourhood",
        "transport_hub",
        "other"
    ]
    tags: List[str] = []

    avg_visit_duration_hours: float
    opening_hours: Optional[str] = None
    requires_booking: bool = False
    entry_price_eur: float = 0.0

    wheelchair_accessible: bool = False
    kid_friendly: bool = False
    senior_friendly: bool = False

    avg_crowd_level: float = Field(0.5, ge=0.0, le=1.0)   # 0 = empty, 1 = packed
    is_overtouristed: bool = False
    sustainability_score: float = Field(0.5, ge=0.0, le=1.0)

    outdoor_score: float = Field(0.0, ge=0.0, le=1.0)
    cultural_score: float = Field(0.0, ge=0.0, le=1.0)
    food_score: float = Field(0.0, ge=0.0, le=1.0)
    architecture_score: float = Field(0.0, ge=0.0, le=1.0)
    shopping_score: float = Field(0.0, ge=0.0, le=1.0)
    nightlife_score: float = Field(0.0, ge=0.0, le=1.0)
    nature_score: float = Field(0.0, ge=0.0, le=1.0)

    google_rating: Optional[float] = Field(None, ge=0.0, le=5.0)
    review_count: Optional[int] = None
    local_favourite: bool = False

class POISentiment(BaseModel):
    poi_name: str
    sentiment: Literal["very_positive", "positive", "neutral", "negative", "very_negative"]
    reason: str

class TripSentiment(BaseModel):
    overall_sentiment: Literal["very_positive", "positive", "neutral", "negative", "very_negative"]
    overall_score: float = Field(ge=0.0, le=10.0)
    summary: str
    highlights: List[str]
    pain_points: List[str]
    would_recommend: bool
    would_return: bool
    poi_sentiments: List[POISentiment]
    emotional_arc: Literal[
        "consistently_positive",
        "started_strong_tired_out",
        "slow_start_great_finish",
        "mixed_throughout",
        "mostly_negative"
    ]
    suggested_improvements: List[str]


class POIState(BaseModel):
    poi: POI
    total_visits: int = 0
    total_dwell_hours: float = 0.0
    visitor_ids: list[int] = []
    visit_times: list[float] = []

    model_config = {"arbitrary_types_allowed": True}

    @computed_field
    @property
    def avg_dwell_hours(self) -> float:
        return self.total_dwell_hours / self.total_visits if self.total_visits else 0.0

    @computed_field
    @property
    def peak_hour(self) -> float | None:
        if not self.visit_times:
            return None
        buckets = {}
        for t in self.visit_times:
            h = int(t)
            buckets[h] = buckets.get(h, 0) + 1
        return float(max(buckets, key=buckets.get))

    def record_visit(self, agent_id: int, arrival_time: float, dwell_hours: float):
        self.total_visits += 1
        self.total_dwell_hours += dwell_hours
        self.visitor_ids.append(agent_id)
        self.visit_times.append(arrival_time)

    def to_dict(self) -> dict:
        return {
            "poi_id":            self.poi.id,
            "poi_name":          self.poi.name,
            "category":          self.poi.category,
            "total_visits":      self.total_visits,
            "unique_visitors":   len(set(self.visitor_ids)),
            "avg_dwell_hours":   round(self.avg_dwell_hours, 2),
            "total_dwell_hours": round(self.total_dwell_hours, 2),
            "peak_hour":         self.peak_hour,
            "visit_times":       self.visit_times,
        }
    
class POITracker(BaseModel):
    states: dict[str, POIState] = {}

    def setup(self, pois: list[POI]):
        self.states = {poi.id: POIState(poi=poi) for poi in pois}

    def record(self, poi: POI, agent_id: int, arrival_time: float):
        self.states[poi.id].record_visit(
            agent_id=agent_id,
            arrival_time=arrival_time,
            dwell_hours=poi.avg_visit_duration_hours,
        )

    def sorted_by_visits(self) -> list[POIState]:
        return sorted(self.states.values(), key=lambda s: s.total_visits, reverse=True)

    def to_dict(self) -> dict:
        return {pid: s.to_dict() for pid, s in self.states.items()}