import json
import math

from typing import List

from models import (POI, TouristProfile)

def load_pois(filepath: str) -> List[POI]:
    with open(filepath, 'r', encoding='utf-8') as f:
        data = json.load(f)
    return [POI(**item) for item in data]

def calculate_distance_km(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    return math.sqrt((lat1 - lat2)**2 + (lng1 - lng2)**2) * 111.0

def calculate_aware_matching_score(profile: TouristProfile, poi: POI) -> float:
    base_score = (
        profile.cultural_interest * poi.cultural_score +
        profile.architecture_interest * poi.architecture_score +
        profile.food_interest * poi.food_score +
        profile.outdoor_preference * poi.outdoor_score +
        profile.shopping_interest * poi.shopping_score +
        profile.nightlife_interest * poi.nightlife_score +
        profile.nature_interest * poi.nature_score
    )
    
    matched_tags = set(profile.interests).intersection(set(poi.tags))
    base_score += len(matched_tags) * 0.2
    
    if poi.id in profile.awareness_set:
        novelty_weight = 1.5
        awareness_modifier = (0.5 - profile.novelty_seeking) * novelty_weight
        base_score += awareness_modifier

    if profile.travel_with_seniors and not poi.senior_friendly:
        base_score *= 0.5
    if profile.travel_with_kids and not poi.kid_friendly:
        base_score *= 0.5
    if profile.budget_level == "low" and poi.entry_price_eur > 15.0:
        base_score *= 0.2
        
    return round(max(0.0, base_score), 2)

def recommend_top_6(profile: TouristProfile, all_pois: List[POI]) -> List[POI]:
    scored_pois = [(poi, calculate_aware_matching_score(profile, poi)) for poi in all_pois]
    scored_pois.sort(key=lambda x: x[1], reverse=True)
    return [poi for poi, score in scored_pois[:6]]