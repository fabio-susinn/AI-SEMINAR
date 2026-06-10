from abc import ABC, abstractmethod
from typing import List
import math


from models import TouristProfile, POI


# Base Class for Scoring Strategies
class ScoringStrategy(ABC):
    @abstractmethod
    def score(self, profile: TouristProfile, poi: POI) -> float:
        ...

    def __call__(self, profile: TouristProfile, poi: POI) -> float:
        return self.score(profile, poi)
    





##################################
## POPULARITY-BASED RECOMMENDER ##
##################################

class PopularityBasedStrategy(ScoringStrategy):
    '''
    Non-Personalised Strategy --> Ranks POIs based on overall popularity
    '''

    _max_log_reviews = 12.1 # log(180k) ~ max review count in dataset
    w_rating = 0.5
    w_reviews = 0.35
    w_crowd = 0.15

    def score(self, profile: TouristProfile, poi: POI) -> float:
        # Hard Filter --> only allow if have enough money
        if poi.entry_price_eur > profile.daily_budget_eur:
            return 0.0
 
        # Rating component
        rating_norm = (poi.google_rating / 5.0) if poi.google_rating else 0.6 # set 0.6 as the prior for unrated POIs 
 
        # Review-count component (log-scale) 
        review_norm = 0.0
        if poi.review_count and poi.review_count > 0:
            review_norm = min(math.log(poi.review_count + 1) / self._max_log_reviews, 1.0)
 
        # Crowd component
        crowd_norm = poi.avg_crowd_level
 
        score = (
            self.w_rating  * rating_norm  +
            self.w_reviews * review_norm  +
            self.w_crowd   * crowd_norm
        )
 
        return round(max(0.0, score), 2)



################################
## INTEREST-BASED RECOMMENDER ##
################################

class InterestsBasedStrategy(ScoringStrategy):
    ''' 
    Personalised Strategy --> Ranks POIs based on alignment with user's interests and preferences
    '''
    tag_boost = 0.30 # per matched tag
    crowd_weight = 0.40 # scales the crowd penalty
 
    def score(self, profile: TouristProfile, poi: POI) -> float:
        # Hard filters 
        if poi.entry_price_eur > profile.daily_budget_eur:
            return 0.0
        if profile.travel_with_seniors and not poi.senior_friendly:
            return 0.0
        if profile.travel_with_kids and not poi.kid_friendly:
            return 0.0
 
        # Interest dot-product
        base_score = (
            profile.cultural_interest * poi.cultural_score +
            profile.architecture_interest* poi.architecture_score +
            profile.food_interest * poi.food_score +
            profile.outdoor_preference * poi.outdoor_score +
            profile.shopping_interest * poi.shopping_score  +
            profile.nightlife_interest * poi.nightlife_score +
            profile.nature_interest * poi.nature_score
        )
 
        # Tag-matching boost
        matched_tags = set(profile.interests).intersection(set(poi.tags))
        tag_score = len(matched_tags) * self.tag_boost
 
        # Crowd penalty ────────────────────────────────────────────
        crowd_penalty = poi.avg_crowd_level * profile.crowd_aversion * self.crowd_weight
 
        total = base_score + tag_score - crowd_penalty
 
        return round(max(0.0, total), 2)



#####################################################
## MULTI-CRITERIA SUSTAINABILITY-AWARE RECOMMENDER ##
#####################################################

class SustainabilityAwareStrategy(ScoringStrategy):
    '''
    Balances individual preference satisfaction against three system-level objectives: sustainability, equity, and de-crowding.
    '''
    # Main weights 
    W_RELEVANCE  = 0.40   
    W_SUSTAINABILITY = 0.20
    W_EQUITY = 0.25   
    W_DECROWD = 0.25   

    # Sub-weights within each component
    TAG_BOOST = 0.20   
    LOCAL_BASE_BONUS = 0.50
    OVERTOURISM_MALUS = 0.40 
 
    # Soft accessibility multipliers
    SENIOR_FRIENDLY_BOOST = 1.15
    SENIOR_UNFRIENDLY_FACTOR = 0.80
    KID_FRIENDLY_BOOST = 1.10
    KID_UNFRIENDLY_FACTOR = 0.75
    BUDGET_STRETCH_FACTOR = 0.30   
                                      
 
    def score(self, profile: TouristProfile, poi: POI) -> float:
 
        # Hard filter
        if poi.entry_price_eur > profile.daily_budget_eur:
            return 0.0
 
        # RELEVANCE 
        interest_dot = (
            profile.cultural_interest * poi.cultural_score +
            profile.architecture_interest * poi.architecture_score +
            profile.food_interest * poi.food_score +
            profile.outdoor_preference * poi.outdoor_score +
            profile.shopping_interest * poi.shopping_score +
            profile.nightlife_interest * poi.nightlife_score +
            profile.nature_interest * poi.nature_score
        )
 
        matched_tags = set(profile.interests).intersection(set(poi.tags))
        relevance = interest_dot + len(matched_tags) * self.TAG_BOOST
 
        # SUSTAINABILITY
        sustainability = poi.sustainability_score * (
            0.5 + 0.5 * profile.sustainability_sensitivity
        )
 
        # EQUITY (local / under-visited bonus)
        equity = 0.0
        if poi.local_favourite:
            equity = self.LOCAL_BASE_BONUS * (0.5 + 0.5 * profile.novelty_seeking)
 
        # DE-CROWDING PENALTY 
        decrowd_penalty = poi.avg_crowd_level * (
            0.5 + 0.5 * profile.crowd_aversion
        )

        if poi.is_overtouristed:
            decrowd_penalty += self.OVERTOURISM_MALUS
 
        # Combine components
        score = (
            self.W_RELEVANCE* relevance +
            self.W_SUSTAINABILITY * sustainability +
            self.W_EQUITY * equity  -
            self.W_DECROWD * decrowd_penalty
        )
 
        # Soft accessibility modifiers
        if profile.travel_with_seniors:
            score *= (
                self.SENIOR_FRIENDLY_BOOST if poi.senior_friendly
                else self.SENIOR_UNFRIENDLY_FACTOR
            )
        if profile.travel_with_kids:
            score *= (
                self.KID_FRIENDLY_BOOST if poi.kid_friendly
                else self.KID_UNFRIENDLY_FACTOR
            )
 
        # Soft budget stretch for low-budget tourists at moderately priced POIs
        if profile.budget_level == "low" and poi.entry_price_eur > 15.0:
            score *= self.BUDGET_STRETCH_FACTOR
 
        return round(max(0.0, score), 2)
