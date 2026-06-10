from typing import Literal
from pydantic import BaseModel


class SimulationRequest(BaseModel):
    agents:       int     = 10
    seed:         int | None = None
    workers:      int     = 5
    no_sentiment: bool    = False
    strategy:     Literal["popularity", "interests", "sustainability"] = "interests"


class SimulationResponse(BaseModel):
    agents:     list[dict]
    poi_states: list[dict]
    sentiment:  list[dict] | None = None   # None when no_sentiment=True