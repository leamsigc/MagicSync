import logging
from typing import Optional
from collections import defaultdict
from dataclasses import dataclass

logger = logging.getLogger(__name__)

ALIASES = {
    "william": ["will", "willie", "billy", "liam"],
    "robert": ["bob", "bobby", "rob", "robbie"],
    "richard": ["rick", "ricky", "dick", "dickie"],
    "james": ["jim", "jimmy", "jamie"],
    "michael": ["mike", "mikey", "mick"],
    "john": ["jack", "johnny"],
    "jennifer": ["jen", "jenny"],
    "elizabeth": ["liz", "lizzy", "beth", "betty"],
    "margaret": ["maggie", "meg", "peggy"],
    "thomas": ["tom", "tommy"],
    "charles": ["charlie", "chuck"],
    "daniel": ["dan", "danny"],
    "matthew": ["matt", "matty"],
    "anthony": ["tony", "ant"],
    "christopher": ["chris"],
    "joseph": ["joe", "joey"],
    "andrew": ["andy", "drew"],
    "joshua": ["josh"],
    "kenneth": ["ken", "kenny"],
    "kevin": ["kev"],
    "brian": ["bri"],
    "david": ["dave", "davey"],
    "edward": ["ed", "eddie", "ted", "teddy"],
    "ronald": ["ron", "ronnie"],
    "timothy": ["tim", "timmy"],
    "jason": ["jay"],
    "jeffrey": ["jeff"],
    "ryan": ["ry"],
    "jacob": ["jake"],
    "gary": ["gar"],
    "nicholas": ["nick", "nicky"],
    "eric": ["rick"],
    "jonathan": ["jon", "jonny"],
    "stephen": ["steve", "stevie"],
    "larry": ["lawrence"],
    "justin": ["just"],
    "scott": ["scotty"],
    "brandon": ["brand"],
    "benjamin": ["ben", "benny"],
    "samuel": ["sam", "sammy"],
    "raymond": ["ray"],
    "gregory": ["greg", "gregg"],
    "frank": ["frankie"],
    "alexander": ["alex", "al"],
    "patrick": ["pat", "paddy"],
    "jack": ["john"],
    "dennis": ["denny"],
    "jerry": ["gerald"],
    "tyler": ["ty"],
    "aaron": ["ari"],
    "henry": ["hank", "harry"],
    "douglas": ["doug"],
    "peter": ["pete"],
    "adam": ["ad"],
    "nathan": ["nate"],
    "zachary": ["zach", "zack"],
    "walter": ["walt"],
    "kyle": ["ky"],
    "harold": ["harry"],
    "carl": ["carlo"],
    "arthur": ["art", "arty"],
    "gerald": ["gerry", "jerry"],
    "roger": ["rog"],
    "keith": ["kei"],
    "lawrence": ["larry", "laurie"],
    "albert": ["al", "bert"],
    "willie": ["will", "william"],
    "ralph": ["ralphie"],
    "roy": ["leonard"],
    "eugene": ["gene"],
    "russell": ["russ"],
    "bobby": ["bob", "robert"],
    "philip": ["phil"],
    "harry": ["harold", "henry"],
    "vincent": ["vince", "vinnie"],
    "johnny": ["john", "jack"],
    "eleanor": ["ellie", "nell", "nellie"],
    "susan": ["sue", "susie"],
    "rebecca": ["becky", "becca"],
    "sandra": ["sandy"],
    "kathryn": ["kathy", "katie"],
    "deborah": ["debbie", "deb"],
    "jessica": ["jess", "jessie"],
    "sharon": ["shari"],
    "michelle": ["shelly"],
    "laura": ["laurie"],
    "sarah": ["sari"],
    "amanda": ["mandy"],
    "melissa": ["missy", "mel"],
    "brenda": ["bren"],
    "amy": ["amia"],
    "anna": ["anne", "annie"],
    "rebecca": ["becky"],
    "victoria": ["vicki", "vickie", "tori"],
    "katherine": ["kathy", "katie", "kate"],
    "christina": ["chris", "tina"],
    "janet": ["jan"],
    "catherine": ["cathy", "kate", "cat"],
    "frances": ["fran", "frannie"],
    "joyce": ["joy"],
    "diane": ["di", "debbie"],
    "carol": ["carrie"],
    "ruth": ["ruthie"],
    "julia": ["julie", "juli"],
    "heather": ["heath"],
    "teresa": ["terri", "terry"],
    "doris": ["dorie"],
    "gloria": ["glorie"],
    "evelyn": ["eve", "evie"],
    "jean": ["jeanette"],
    "martha": ["marty"],
    "debra": ["debbie"],
    "ada": ["addie"],
}


@dataclass
class EntityCluster:
    """Cluster of related entity values."""
    canonical: str
    variants: list[str]
    entity_type: str


class EntityResolver:
    """Resolve and cluster entity variants (names, etc.)."""
    
    def __init__(self, mode: str = "algorithmic"):
        """
        Initialize resolver.
        
        Modes:
        - algorithmic: Union-Find + nickname resolution
        - llm: Use Ollama for clustering
        - none: Direct 1:1 mapping
        """
        self.mode = mode
        self._clusters: dict[str, list[EntityCluster]] = {}

    def resolve(self, entities: list[str], entity_type: str = "PERSON") -> list[EntityCluster]:
        """
        Resolve entities into clusters.
        
        Returns list of clusters with canonical + variants.
        """
        if self.mode == "none":
            return self._direct_mapping(entities, entity_type)
        
        if self.mode == "algorithmic":
            return self._algorithmic_clustering(entities, entity_type)
        
        return self._direct_mapping(entities, entity_type)

    def _direct_mapping(self, entities: list[str], entity_type: str) -> list[EntityCluster]:
        """Direct 1:1 mapping (no clustering)."""
        return [
            EntityCluster(canonical=e, variants=[e], entity_type=entity_type)
            for e in entities
        ]

    def _algorithmic_clustering(self, entities: list[str], entity_type: str) -> list[EntityCluster]:
        """Union-Find based clustering with nickname resolution."""
        parent = {e: e for e in entities}
        
        def find(x: str) -> str:
            if parent[x] != x:
                parent[x] = find(parent[x])
            return parent[x]
        
        def union(x: str, y: str):
            px, py = find(x), find(y)
            if px != py:
                parent[px] = py
        
        for entity in entities:
            normalized = entity.lower().strip()
            
            for base, aliases in ALIASES.items():
                if normalized == base or normalized in aliases:
                    for other in entities:
                        other_norm = other.lower().strip()
                        if other_norm == base or other_norm in aliases:
                            union(entity, other)
        
        clusters: dict[str, list[str]] = defaultdict(list)
        for entity in entities:
            clusters[find(entity)].append(entity)
        
        result = []
        for variant_list in clusters.values():
            if len(variant_list) == 1:
                canonical = variant_list[0]
            else:
                canonical = min(variant_list, key=lambda x: len(x))
            
            result.append(EntityCluster(
                canonical=canonical,
                variants=variant_list,
                entity_type=entity_type
            ))
        
        return result

    async def resolve_llm(self, entities: list[str], entity_type: str) -> list[EntityCluster]:
        """
        Use LLM (Ollama) for clustering.
        
        This is a placeholder - requires calling the LLM service.
        """
        if self.mode != "llm":
            return self._algorithmic_clustering(entities, entity_type)
        
        logger.info("LLM clustering not implemented - falling back to algorithmic")
        return self._algorithmic_clustering(entities, entity_type)

    def get_original(self, surrogate: str, entity_type: str, user_id: str) -> Optional[str]:
        """Get original value from surrogate."""
        return None


entity_resolver = EntityResolver(mode="algorithmic")