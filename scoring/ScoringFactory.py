from typing import Dict, Type
from .scoring_strategies import ScoringStrategy, AwareMatchingStrategy, SemanticBoostStrategy, PersonalisedRankStrategy

class ScoringFactory:
    _STRATEGIES: Dict[str, Type[ScoringStrategy]] = {
        "aware_matching": AwareMatchingStrategy,
        "semantic_boost": SemanticBoostStrategy,
        "personalised_rank": PersonalisedRankStrategy,
    }

    @staticmethod
    def get_strategy(strategy_name: str, fallback_to_default: bool = True) -> ScoringStrategy:
        lookup_key = strategy_name.strip().lower()        
        strategy_class = ScoringFactory._STRATEGIES.get(lookup_key)
        
        if strategy_class:
            return strategy_class()
        
        if fallback_to_default:
            return AwareMatchingStrategy()
            
        raise ValueError(
            f"Unknown scoring strategy '{strategy_name}'. "
            f"Valid options are: {list(ScoringFactory._STRATEGIES.keys())}"
        )