import uuid

from pydantic import BaseModel, Field
from typing import List, Literal

class TouristProfile(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    awareness_set: List[str] = []

    age: int
    nationality: str

    group_size: int
    travel_with_kids: bool
    travel_with_seniors: bool

    budget_level: Literal["low", "medium", "high"]
    daily_budget_eur: float

    mobility_mode: Literal[
        "walking",
        "bike",
        "public_transport",
        "car",
        "mixed"
    ]

    walking_tolerance: Literal["low", "medium", "high"]

    max_walking_distance_km: float

    interests: List[str]

    outdoor_preference: float
    cultural_interest: float
    food_interest: float
    architecture_interest: float
    shopping_interest: float
    nightlife_interest: float
    nature_interest: float

    crowd_aversion: float
    sustainability_sensitivity: float
    novelty_seeking: float

    available_hours: float
    trip_length_days: int

    fatigue: float = 0.0
    satisfaction: float = 0.0
    money_spent: float = 0.0