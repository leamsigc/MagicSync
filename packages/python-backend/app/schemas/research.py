"""Research run input/output contracts (T50 §3, §8)."""

from pydantic import BaseModel, Field


class ResearchRequest(BaseModel):
    """Structured research input from chat, workflow runs, or API calls."""

    business_id: str | None = None
    brief: str = Field(..., min_length=1, max_length=8000)
    reference_document_ids: list[str] = Field(default_factory=list, max_length=50)
    reference_urls: list[str] = Field(default_factory=list, max_length=10)
    platforms: list[str] = Field(default_factory=list, max_length=20)
    lookback_days: int = Field(default=30, ge=1, le=365)
    desired_output: str = Field(default="topic_candidates", max_length=80)
    use_business_context: bool = False
    business_context: str | None = None
    context_edition_id: str | None = None
    max_sources: int = Field(default=10, ge=1, le=30)


class TopicCandidate(BaseModel):
    """One research topic candidate with evidence links."""

    title: str = ""
    angle: str = ""
    hook: str = ""
    audience_need: str = Field(default="", alias="audienceNeed")
    platform_fit: list[str] = Field(default_factory=list, alias="platformFit")
    evidence: list[str] = Field(default_factory=list)
    confidence: str = "low"

    model_config = {"populate_by_name": True}


class ResearchSource(BaseModel):
    """Citation record for one ingested source."""

    id: str
    kind: str
    uri: str
    title: str = ""
    retrieved_at: str = Field(default="", alias="retrievedAt")
    content_hash: str = Field(default="", alias="contentHash")

    model_config = {"populate_by_name": True}


class ResearchResponse(BaseModel):
    """Typed research result reusable by later pipeline nodes."""

    research_id: str = Field(default="", alias="researchId")
    summary: str = ""
    topic_candidates: list[TopicCandidate] = Field(default_factory=list, alias="topicCandidates")
    sources: list[ResearchSource] = Field(default_factory=list)
    claims: list[dict] = Field(default_factory=list)
    warnings: list[str] = Field(default_factory=list)

    model_config = {"populate_by_name": True}
