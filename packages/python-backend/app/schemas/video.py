from pydantic import BaseModel


class DownloadVideoRequest(BaseModel):
    url: str
    business_id: str | None = None


class DownloadVideoResponse(BaseModel):
    success: bool
    filename: str
    title: str
    filepath: str
    duration: int | None = None
    ext: str = "mp4"
    width: int | None = None
    height: int | None = None
    webpage_url: str
    thumbnail: str | None = None
    asset_url: str | None = None
    error: str | None = None


class AnalyzeTranscriptionRequest(BaseModel):
    transcription: str
    topic_hint: str | None = None


class StructureSection(BaseModel):
    section: str
    content_summary: str


class AnalyzeTranscriptionResponse(BaseModel):
    success: bool
    hook_type: str = ""
    hook_text: str = ""
    estimated_hook_duration_seconds: int = 0
    structure: list[StructureSection] = []
    pattern: str = ""
    retention_triggers: list[str] = []
    cta_type: str = ""
    target_audience: str = ""
    replicable_template: str = ""
    error: str | None = None