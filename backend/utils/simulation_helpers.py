import json
import math
from typing import List

from models import TouristProfile, POI
from scoring import ScoringFactory, ScoringStrategy





def load_pois(filepath: str) -> List[POI]:
    with open(filepath, 'r', encoding='utf-8') as f:
        data = json.load(f)
    return [POI(**item) for item in data]


def calculate_distance_km(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    '''
    Haversine formula to compute distance between two points in kilometers.
    '''
    R = 6371.0
    dlat = math.radians(lat2 - lat1)
    dlng = math.radians(lng2 - lng1)
    a = (
        math.sin(dlat / 2) ** 2
        + math.cos(math.radians(lat1))
        * math.cos(math.radians(lat2))
        * math.sin(dlng / 2) ** 2
    )
    return R * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))


def score_poi(profile: TouristProfile, poi: POI, strategy: ScoringStrategy | str = "interests") -> float:
    '''
    Score a single (profile, POI) pair using the given strategy.
    '''
    if isinstance(strategy, str):
        strategy = ScoringFactory.get_strategy(strategy)
    return strategy.score(profile, poi)


def recommend_top_n(profile: TouristProfile, all_pois: List[POI], n: int = 6, strategy: ScoringStrategy | str = "interests") -> List[POI]:
    '''
    Return the top-N POIs for a given profile given a scoring strategy.
    '''
    if isinstance(strategy, str):
        strategy = ScoringFactory.get_strategy(strategy)
 
    scored = [(poi, strategy.score(profile, poi)) for poi in all_pois]
    scored.sort(key=lambda x: x[1], reverse=True)
    return [poi for poi, _ in scored[:n]]