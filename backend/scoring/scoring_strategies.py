from abc import ABC, abstractmethod
from typing import TYPE_CHECKING
import math

from models import TouristProfile, POI

if TYPE_CHECKING:
    from models import POITracker


class ScoringStrategy(ABC):
    def __init__(self):
        self.max_score = -float('inf')
        self.min_score = float('inf')

    @abstractmethod
    def score(self, profile: TouristProfile, poi: POI,
              tracker: "POITracker | None" = None) -> float:
        ...

    def __call__(self, profile: TouristProfile, poi: POI,
                 tracker: "POITracker | None" = None) -> float:
        score = self.score(profile, poi, tracker)  # ← pass tracker through
        return score


class PopularityBasedStrategy(ScoringStrategy):
    _max_log_reviews = 12.1
    w_rating  = 5.0
    w_reviews = 4.0
    w_crowd   = 0.15

    def __init__(self):
        super().__init__()

    def score(self, profile: TouristProfile, poi: POI,
              tracker: "POITracker | None" = None) -> float:
        if poi.entry_price_eur > profile.daily_budget_eur:
            self.min_score = min(self.min_score, 0)
            return 0.0

        rating_norm = (poi.google_rating / 5.0) if poi.google_rating else 0.6
        clean_review_count = max(poi.review_count, 1) if poi.review_count is not None else 1

        crowd_norm = 1.0 - poi.avg_crowd_level

        score = (
            self.w_rating  * rating_norm  +
            self.w_reviews * max(clean_review_count, 1) +
            self.w_crowd   * crowd_norm
        )
        score = round(max(0.0, score), 2) / (720004.7) * 10
        self.max_score = max(self.max_score, score)
        self.min_score = min(self.min_score, score)

        return score


class InterestsBasedStrategy(ScoringStrategy):

    tag_boost    = 9.00
    crowd_weight = 0.40

    def __init__(self):
        super().__init__()

    def score(self, profile: TouristProfile, poi: POI,
              tracker: "POITracker | None" = None) -> float:
        if poi.entry_price_eur > profile.daily_budget_eur:
            self.min_score = min(self.min_score, 0.0)
            return 0.0
        if profile.travel_with_seniors and not poi.senior_friendly:
            self.min_score = min(self.min_score, 0.0)
            return 0.0
        if profile.travel_with_kids and not poi.kid_friendly:
            self.min_score = min(self.min_score, 0.0)
            return 0.0

        base_score = (
            profile.cultural_interest      * poi.cultural_score +
            profile.architecture_interest  * poi.architecture_score +
            profile.food_interest          * poi.food_score +
            profile.outdoor_preference     * poi.outdoor_score +
            profile.shopping_interest      * poi.shopping_score +
            profile.nightlife_interest     * poi.nightlife_score +
            profile.nature_interest        * poi.nature_score
        )

        matched_tags = set(profile.interests).intersection(set(poi.tags))
        tag_score = len(matched_tags) * self.tag_boost

        crowd = tracker.get_live_crowd(poi.id) if tracker else poi.avg_crowd_level
        crowd_penalty = crowd * profile.crowd_aversion * self.crowd_weight

        score = round(max(0.0, base_score + tag_score - crowd_penalty), 2) / (38.12) * 10
        self.max_score = max(self.max_score, score)
        self.min_score = min(self.min_score, score)

        return score


class SustainabilityAwareStrategy(ScoringStrategy):

    W_RELEVANCE      = 2.00
    W_SUSTAINABILITY = 4.00
    W_EQUITY         = 0.25
    W_DECROWD        = 3.0

    TAG_BOOST          = 0.20
    LOCAL_BASE_BONUS   = 0.50
    OVERTOURISM_MALUS  = 1.0

    SENIOR_FRIENDLY_BOOST    = 1.5
    SENIOR_UNFRIENDLY_FACTOR = 0.70
    KID_FRIENDLY_BOOST       = 1.5
    KID_UNFRIENDLY_FACTOR    = 0.70
    BUDGET_STRETCH_FACTOR    = 0.70

    def __init__(self):
        super().__init__()

    def score(self, profile: TouristProfile, poi: POI,
              tracker: "POITracker | None" = None) -> float:
        
        if poi.entry_price_eur > profile.daily_budget_eur:
            self.min_score = min(self.min_score, 0.0)
            return 0.0

        interest_dot = (
            profile.cultural_interest      * poi.cultural_score +
            profile.architecture_interest  * poi.architecture_score +
            profile.food_interest          * poi.food_score +
            profile.outdoor_preference     * poi.outdoor_score +
            profile.shopping_interest      * poi.shopping_score +
            profile.nightlife_interest     * poi.nightlife_score +
            profile.nature_interest        * poi.nature_score
        )
        matched_tags = set(profile.interests).intersection(set(poi.tags))
        relevance = interest_dot + len(matched_tags) * self.TAG_BOOST

        sustainability = poi.sustainability_score * (
            0.5 + 0.5 * profile.sustainability_sensitivity
        )

        equity = 0.0
        if poi.local_favourite:
            equity = self.LOCAL_BASE_BONUS * (0.5 + 0.5 * profile.novelty_seeking)

        crowd = tracker.get_live_crowd(poi.id) if tracker else poi.avg_crowd_level
        decrowd_penalty = crowd * (0.5 + 0.5 * profile.crowd_aversion)
        if poi.is_overtouristed:
            decrowd_penalty += self.OVERTOURISM_MALUS

        score = (
            self.W_RELEVANCE      * relevance +
            self.W_SUSTAINABILITY * sustainability +
            self.W_EQUITY         * equity -
            self.W_DECROWD        * decrowd_penalty
        )

        if profile.travel_with_seniors:
            score *= self.SENIOR_FRIENDLY_BOOST if poi.senior_friendly else self.SENIOR_UNFRIENDLY_FACTOR
        if profile.travel_with_kids:
            score *= self.KID_FRIENDLY_BOOST if poi.kid_friendly else self.KID_UNFRIENDLY_FACTOR
        if profile.budget_level == "low" and poi.entry_price_eur > 15.0:
            score *= self.BUDGET_STRETCH_FACTOR

        score = round(max(0.0, score), 2) / (14.06) * 10  
        self.max_score = max(self.max_score, score)
        self.min_score = min(self.min_score, score)

        return score