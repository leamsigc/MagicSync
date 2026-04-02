import logging
from app.services.pii.engine import pii_engine, SURROGATE_TYPES, HARD_REDACT_TYPES

logger = logging.getLogger(__name__)


class PIIPipeline:
    """PII protection pipeline for chat and tools."""

    def __init__(self):
        self.enabled = True
        self._input_buffer: dict[str, str] = {}
        self._output_buffer: dict[str, str] = {}

    async def anonymize_input(self, text: str, user_id: str) -> str:
        """
        Anonymize user input before sending to LLM.
        
        Steps:
        1. Detect PII entities (two-pass)
        2. Anonymize with surrogates or hard-redact
        3. Return anonymized text
        """
        if not self.enabled or not text:
            return text
        
        try:
            surrogates, hard_redacts = pii_engine.detect_two_pass(text)
            
            if not surrogates and not hard_redacts:
                return text
            
            anonymized = pii_engine.anonymize(text, surrogates, hard_redacts, user_id)
            
            self._input_buffer[text[:50]] = anonymized
            
            logger.info(f"Anonymized input: {len(surrogates)} surrogates, {len(hard_redacts)} hard-redacts")
            return anonymized
            
        except Exception as e:
            logger.error(f"Input anonymization failed: {e}")
            return text

    async def de_anonymize_output(self, text: str, user_id: str) -> str:
        """
        De-anonymize LLM output before returning to user.
        
        Steps:
        1. Replace surrogates with original values
        2. Replace [ENTITY_TYPE] with [REDACTED]
        """
        if not self.enabled or not text:
            return text
        
        try:
            result = pii_engine.de_anonymize(text, user_id)
            
            logger.info(f"De-anonymized output for user {user_id}")
            return result
            
        except Exception as e:
            logger.error(f"Output de-anonymization failed: {e}")
            return text

    async def anonymize_tool_input(self, text: str, user_id: str) -> str:
        """
        Anonymize tool input (e.g., SQL queries).
        
        Focuses on detecting sensitive patterns in tool inputs.
        """
        if not self.enabled or not text:
            return text
        
        try:
            surrogates, hard_redacts = pii_engine.detect_two_pass(text)
            
            if not surrogates and not hard_redacts:
                return text
            
            anonymized = pii_engine.anonymize(text, surrogates, hard_redacts, user_id)
            return anonymized
            
        except Exception as e:
            logger.error(f"Tool input anonymization failed: {e}")
            return text

    async def de_anonymize_tool_output(self, text: str, user_id: str) -> str:
        """
        De-anonymize tool output (e.g., SQL results).
        """
        return await self.de_anonymize_output(text, user_id)

    def clear_user_data(self, user_id: str):
        """Clear stored mappings for a user."""
        pii_engine.clear_mappings(user_id)
        logger.info(f"Cleared PII data for user {user_id}")

    def toggle(self, enabled: bool):
        """Toggle PII protection on/off."""
        self.enabled = enabled
        logger.info(f"PII protection {'enabled' if enabled else 'disabled'}")


pii_pipeline = PIIPipeline()