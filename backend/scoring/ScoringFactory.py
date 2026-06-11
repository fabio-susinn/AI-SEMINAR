from typing import Dict, Type
from .scoring_strategies import ScoringStrategy, PopularityBasedStrategy, InterestsBasedStrategy, SustainabilityAwareStrategy


class ScoringFactory:
    _STRATEGIES: Dict[str, ScoringStrategy] = {
        "popularity": PopularityBasedStrategy(),
        "interests": InterestsBasedStrategy(),
        "sustainability": SustainabilityAwareStrategy(),
    }

    @classmethod
    def get_strategy(cls, strategy_name: str, fallback_to_default: bool = True) -> ScoringStrategy:
        lookup_key = strategy_name.strip().lower()        
        strategy_class = ScoringFactory._STRATEGIES.get(lookup_key)
        
        if strategy_class:
            return strategy_class
        
        if fallback_to_default:
            return PopularityBasedStrategy()
            
        raise ValueError(
            f"Unknown scoring strategy '{strategy_name}'. "
            f"Valid options are: {list(ScoringFactory._STRATEGIES.keys())}"
        )
    
    @classmethod
    def available_strategies(cls) -> list[str]:
        return list(cls._STRATEGIES.keys())
    