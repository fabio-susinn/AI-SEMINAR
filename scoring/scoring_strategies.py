from abc import ABC, abstractmethod
from typing import List
from models import POI, TouristProfile


class ScoringStrategy(ABC):
    @abstractmethod
    def score(self, profile: TouristProfile, poi: POI) -> float:
        ...

class AwareMatchingStrategy(ScoringStrategy):
    def score(self, profile: TouristProfile, poi: POI) -> float:
        base_score = (
            profile.cultural_interest    * poi.cultural_score    +
            profile.architecture_interest* poi.architecture_score+
            profile.food_interest        * poi.food_score        +
            profile.outdoor_preference   * poi.outdoor_score     +
            profile.shopping_interest    * poi.shopping_score    +
            profile.nightlife_interest   * poi.nightlife_score   +
            profile.nature_interest      * poi.nature_score
        )

        matched_tags = set(profile.interests).intersection(set(poi.tags))
        base_score += len(matched_tags) * 0.2

        if poi.id in profile.awareness_set:
            novelty_weight    = 1.5
            awareness_modifier = (0.5 - profile.novelty_seeking) * novelty_weight
            base_score += awareness_modifier

        if profile.travel_with_seniors and not poi.senior_friendly:
            base_score *= 0.5
        if profile.travel_with_kids and not poi.kid_friendly:
            base_score *= 0.5
        if profile.budget_level == "low" and poi.entry_price_eur > 15.0:
            base_score *= 0.2

        return round(max(0.0, base_score), 2)


class SemanticBoostStrategy(ScoringStrategy):
    BOOST_PER_TAG = 0.5

    def score(self, profile: TouristProfile, poi: POI) -> float:
        matched_tags = set(profile.interests).intersection(set(poi.tags))
        tag_boost    = len(matched_tags) * self.BOOST_PER_TAG
        base_score   = sum(
            getattr(profile, f"{dim}_interest", 0) * getattr(poi, f"{dim}_score", 0)
            for dim in ("cultural", "architecture", "food",
                        "shopping", "nightlife", "nature")
        ) + profile.outdoor_preference * poi.outdoor_score

        return round(max(0.0, base_score + tag_boost), 2)


class PersonalisedRankStrategy(ScoringStrategy):
    """Weights scores by demographic fit (seniors, kids) rather than hard-blocking."""

    def score(self, profile: TouristProfile, poi: POI) -> float:
        base_score = (
            profile.cultural_interest * poi.cultural_score +
            profile.nature_interest   * poi.nature_score   +
            profile.food_interest     * poi.food_score
        )

        # Soft affinity instead of hard penalty
        if profile.travel_with_seniors:
            base_score *= 1.2 if poi.senior_friendly else 0.7
        if profile.travel_with_kids:
            base_score *= 1.2 if poi.kid_friendly    else 0.7

        return round(max(0.0, base_score), 2)
