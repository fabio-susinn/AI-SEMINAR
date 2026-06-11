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