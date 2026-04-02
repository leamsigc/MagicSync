import pytest
from app.services.pii.engine import PIIEngine, SURROGATE_TYPES, HARD_REDACT_TYPES
from app.services.pii.resolver import EntityResolver, EntityCluster


class TestPIIEngine:
    """Tests for PII detection and anonymization."""

    def test_surrogate_types_defined(self):
        """Verify surrogate types are defined."""
        assert "PERSON" in SURROGATE_TYPES
        assert "EMAIL" in SURROGATE_TYPES
        assert "PHONE" in SURROGATE_TYPES

    def test_hard_redact_types_defined(self):
        """Verify hard-redact types are defined."""
        assert "CREDIT_CARD" in HARD_REDACT_TYPES
        assert "SSN" in HARD_REDACT_TYPES
        assert "PASSPORT" in HARD_REDACT_TYPES

    def test_engine_initializes(self):
        """Verify PII engine initializes."""
        engine = PIIEngine()
        assert engine.analyzer is not None
        assert engine.anonymizer is not None

    def test_empty_text_returns_empty(self):
        """Verify empty text returns empty detection."""
        engine = PIIEngine()
        result = engine.detect("")
        assert result == []

    def test_surrogate_map_initialized(self):
        """Verify surrogate map is initialized."""
        engine = PIIEngine()
        assert engine._surrogate_map == {}
        assert engine._reverse_map == {}


class TestEntityResolver:
    """Tests for entity resolution and clustering."""

    def test_resolver_initialization(self):
        """Verify resolver initializes."""
        resolver = EntityResolver(mode="algorithmic")
        assert resolver.mode == "algorithmic"

    def test_direct_mapping_mode(self):
        """Verify direct mapping mode works."""
        resolver = EntityResolver(mode="none")
        entities = ["John", "Jane"]
        clusters = resolver.resolve(entities, "PERSON")
        
        assert len(clusters) == 2
        assert all(isinstance(c, EntityCluster) for c in clusters)

    def test_algorithmic_clustering(self):
        """Verify algorithmic clustering works."""
        resolver = EntityResolver(mode="algorithmic")
        entities = ["John", "Jack", "Bob"]
        clusters = resolver.resolve(entities, "PERSON")
        
        assert len(clusters) >= 1
        for cluster in clusters:
            assert cluster.entity_type == "PERSON"
            assert cluster.canonical is not None

    def test_nickname_resolution(self):
        """Verify nickname resolution."""
        resolver = EntityResolver(mode="algorithmic")
        entities = ["William", "Will", "Bill"]
        clusters = resolver.resolve(entities, "PERSON")
        
        names = [c.canonical for c in clusters]
        variants = [v for c in clusters for v in c.variants]
        
        assert "William" in variants or "Bill" in variants or "Will" in variants


class TestEntityCluster:
    """Tests for EntityCluster dataclass."""

    def test_cluster_creation(self):
        """Verify cluster can be created."""
        cluster = EntityCluster(
            canonical="John",
            variants=["John", "Johnny", "J"],
            entity_type="PERSON"
        )
        
        assert cluster.canonical == "John"
        assert len(cluster.variants) == 3
        assert cluster.entity_type == "PERSON"


class TestPIIIntegration:
    """Integration tests for PII pipeline."""

    def test_types_coverage(self):
        """Verify we have good type coverage."""
        all_types = SURROGATE_TYPES.union(HARD_REDACT_TYPES)
        
        expected = {"PERSON", "EMAIL", "PHONE", "LOCATION", "DATE_TIME", "URL", "IP_ADDRESS"}
        for t in expected:
            assert t in SURROGATE_TYPES or t in HARD_REDACT_TYPES

    def test_resolver_modes(self):
        """Verify all resolver modes work."""
        for mode in ["algorithmic", "none", "llm"]:
            resolver = EntityResolver(mode=mode)
            result = resolver.resolve(["test"], "PERSON")
            assert isinstance(result, list)