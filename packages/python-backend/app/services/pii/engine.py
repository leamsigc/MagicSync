import logging
import re
from typing import Optional
from presidio_analyzer import AnalyzerEngine
from presidio_anonymizer import AnonymizerEngine

logger = logging.getLogger(__name__)

SURROGATE_TYPES = {
    "PERSON", "EMAIL", "PHONE", "LOCATION", 
    "DATE_TIME", "URL", "IP_ADDRESS"
}

HARD_REDACT_TYPES = {
    "CREDIT_CARD", "SSN", "ITIN", "BANK_NUMBER", 
    "IBAN", "CRYPTO", "PASSPORT", "DRIVER_LICENSE"
}


class PIIEngine:
    """PII detection and anonymization using Microsoft Presidio."""

    def __init__(self):
        self.analyzer = AnalyzerEngine()
        self.anonymizer = AnonymizerEngine()
        self._surrogate_map: dict[str, dict[str, str]] = {}
        self._reverse_map: dict[str, dict[str, str]] = {}

    def detect(self, text: str, threshold: float = 0.5) -> list[dict]:
        """
        Detect PII entities in text.
        
        Returns list of detected entities with type, start, end, score.
        """
        try:
            results = self.analyzer.analyze(text=text, language='en', score_threshold=threshold)
            return [
                {
                    "entity_type": r.entity_type,
                    "start": r.start,
                    "end": r.end,
                    "text": text[r.start:r.end],
                    "score": r.score,
                }
                for r in results
            ]
        except Exception as e:
            logger.error(f"PII detection failed: {e}")
            return []

    def detect_two_pass(self, text: str) -> tuple[list[dict], list[dict]]:
        """
        Two-pass detection: high threshold for surrogates, low for hard-redact.
        
        Returns: (surrogate_entities, hard_redact_entities)
        """
        all_entities = self.detect(text, threshold=0.0)
        
        surrogates = []
        hard_redacts = []
        
        for entity in all_entities:
            if entity["entity_type"] in SURROGATE_TYPES and entity["score"] >= 0.7:
                surrogates.append(entity)
            elif entity["entity_type"] in HARD_REDACT_TYPES and entity["score"] >= 0.3:
                hard_redacts.append(entity)
        
        return surrogates, hard_redacts

    def anonymize(
        self, 
        text: str, 
        surrogate_entities: list[dict],
        hard_redact_entities: list[dict],
        user_id: str
    ) -> str:
        """
        Anonymize text with two strategies:
        - Surrogates: Faker-generated realistic fakes
        - Hard-redact: [ENTITY_TYPE] placeholders
        """
        if not surrogate_entities and not hard_redact_entities:
            return text
        
        operators = {}
        
        for entity in hard_redact_entities:
            key = f"operator_{entity['start']}_{entity['end']}"
            operators[key] = {
                "type": "replace",
                "new_value": f"[{entity['entity_type']}]"
            }
        
        for entity in surrogate_entities:
            original = entity["text"]
            pii_type = entity["entity_type"]
            
            fake_value = self._get_surrogate(user_id, pii_type, original)
            
            key = f"operator_{entity['start']}_{entity['end']}"
            operators[key] = {
                "type": "replace",
                "new_value": fake_value
            }
            
            self._store_mapping(user_id, fake_value, original, pii_type)
        
        try:
            result = self.anonymizer.anonymize(
                text=text,
                operators=operators
            )
            return result.text
        except Exception as e:
            logger.error(f"Anonymization failed: {e}")
            return text

    def _get_surrogate(self, user_id: str, pii_type: str, original: str) -> str:
        """Generate collision-free surrogate value."""
        if user_id not in self._surrogate_map:
            self._surrogate_map[user_id] = {}
        
        if pii_type not in self._surrogate_map[user_id]:
            self._surrogate_map[user_id][pii_type] = {}
        
        if original in self._surrogate_map[user_id][pii_type]:
            return self._surrogate_map[user_id][pii_type][original]
        
        fake = self._generate_fake(pii_type, original)
        
        while any(fake == v for v in self._surrogate_map[user_id][pii_type].values()):
            fake = self._generate_fake(pii_type, original)
        
        self._surrogate_map[user_id][pii_type][original] = fake
        return fake

    def _generate_fake(self, pii_type: str, original: str) -> str:
        """Generate fake value based on entity type."""
        from faker import Faker
        fake = Faker()
        
        if pii_type == "PERSON":
            return fake.name()
        elif pii_type == "EMAIL":
            return fake.email()
        elif pii_type == "PHONE":
            return fake.phone_number()
        elif pii_type == "LOCATION":
            return fake.city()
        elif pii_type == "DATE_TIME":
            return fake.date().isoformat()
        elif pii_type == "URL":
            return fake.url()
        elif pii_type == "IP_ADDRESS":
            return fake.ipv4()
        
        return fake.word()

    def _store_mapping(self, user_id: str, fake_value: str, original: str, pii_type: str):
        """Store mapping for de-anonymization."""
        if user_id not in self._reverse_map:
            self._reverse_map[user_id] = {}
        
        if pii_type not in self._reverse_map[user_id]:
            self._reverse_map[user_id][pii_type] = {}
        
        self._reverse_map[user_id][pii_type][fake_value.lower()] = original

    def de_anonymize(self, text: str, user_id: str) -> str:
        """
        Reverse anonymization: replace surrogates with original values.
        """
        if user_id not in self._reverse_map:
            return text
        
        result = text
        
        for pii_type, mappings in self._reverse_map[user_id].items():
            for fake, original in mappings.items():
                pattern = re.compile(re.escape(fake), re.IGNORECASE)
                result = pattern.sub(original, result)
        
        hard_pattern = re.compile(r'\[(CREDIT_CARD|SSN|ITIN|BANK_NUMBER|IBAN|CRYPTO|PASSPORT|DRIVER_LICENSE)\]', re.IGNORECASE)
        result = hard_pattern.sub('[REDACTED]', result)
        
        return result

    def clear_mappings(self, user_id: str):
        """Clear stored mappings for a user."""
        if user_id in self._surrogate_map:
            del self._surrogate_map[user_id]
        if user_id in self._reverse_map:
            del self._reverse_map[user_id]


pii_engine = PIIEngine()