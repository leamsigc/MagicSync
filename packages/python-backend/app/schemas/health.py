from pydantic import BaseModel


class HealthResponse(BaseModel):
    status: str
    service: str


class OllamaHealthResponse(BaseModel):
    status: str
    models: list[str] | None = None
    message: str | None = None
