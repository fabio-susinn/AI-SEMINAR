from pydantic import BaseModel, Field
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
    local_favourite: bool = False    # hidden gem vs tourist trap