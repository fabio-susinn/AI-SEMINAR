from pydantic import BaseModel, Field
from typing import List, Literal

class SimulationRequest(BaseModel):
    agents:       int     = 10
    seed:         int | None = None
    workers:      int     = 5
    no_sentiment: bool    = False
    strategy:     Literal["popularity", "interests", "sustainability"] = "interests"


class SimulationResponse(BaseModel):
    agents:     list[dict]
    poi_states: list[dict]
    sentiment:  list[dict] | None = None 


class ItineraryStepSchema(BaseModel):
    order: int = Field(..., description="Chronological stop index (starts at 0)", ge=0)
    poi_id: int = Field(..., description="Unique identifier of the visited POI", ge=0)
    poi_name: str = Field(..., description="Official name of the POI", examples=["Gran Teatre del Liceu"])
    category: str = Field(..., description="Classification type of the POI", examples=["museum", "monument"])
    arrival_h: float = Field(..., description="Raw arrival time as decimal hour", ge=0.0, le=24.0)
    timestamp: str = Field(..., description="Human-readable clock format for frontend", examples=["09:00", "11:29"])
    price: float = Field(..., description="Entry admission price in Euros", ge=0.0)
    crowd: float = Field(..., description="Crowd density coefficient", ge=0.0, le=1.0)

class AgentItineraryResponse(BaseModel):
    agent_id: int = Field(..., description="The unique identification number of the tourist agent", ge=0)
    itinerary: List[ItineraryStepSchema] = Field(..., description="Chronologically sorted list of itinerary steps")


class FairnessMetrics(BaseModel):
    low_budget_avg_pois: float
    high_budget_avg_pois: float
    vulnerable_group_avg_satisfaction: float
    standard_group_avg_satisfaction: float

class EvaluationMetricsResponse(BaseModel):
    total_visits: int
    spatial_gini_index: float
    overtourism_concentration_ratio: float
    local_revenue_distribution_ratio: float
    catalog_coverage_ratio: float
    intra_list_diversity_avg_tags: float
    average_tourist_satisfaction: float
    average_transit_walk_fatigue: float
    avg_pois_visited: float
    precision_interest_match_ratio: float
    fairness_metrics: FairnessMetrics

class TopPOIEntry(BaseModel):
    poi_id: int
    poi_name: str
    visits: int
    avg_dwell: float
 
class NeighbourhoodEntry(BaseModel):
    neighbourhood: str
    visits: int
 
class CategoryEntry(BaseModel):
    category: str
    visits: int
 
class HourEntry(BaseModel):
    hour: int
    label: str
    count: int
 
class VisitMetricsResponse(BaseModel):
    top_pois: List[TopPOIEntry]
    by_neighbourhood: List[NeighbourhoodEntry]
    by_category: List[CategoryEntry]
    by_hour: List[HourEntry]