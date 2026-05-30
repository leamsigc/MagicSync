import asyncio
import logging
import os

import httpx
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import FileResponse

from app.core.config import settings
from app.core.security import require_user, UserContext
from app.schemas.video import (
    DownloadVideoRequest,
    DownloadVideoResponse,
    AnalyzeTranscriptionRequest,
    AnalyzeTranscriptionResponse,
    StructureSection,
)
from app.services.video import video_downloader
from app.services.video.analysis import VideoAnalysisService

logger = logging.getLogger(__name__)

router = APIRouter()
analysis_service = VideoAnalysisService()


@router.post("/download", response_model=DownloadVideoResponse)
async def download_video(
    request: DownloadVideoRequest,
    user: UserContext = Depends(require_user),
):
    if not request.url.strip():
        raise HTTPException(status_code=400, detail="URL is required")

    url = request.url.strip()

    try:
        result = await video_downloader.download(url)
    except Exception as e:
        raise HTTPException(status_code=502, detail=str(e))

    asset_url: str | None = None

    if request.business_id:
        try:
            asset_url = await _upload_to_assets(result.filepath, result.filename, user.user_id, request.business_id)
        except Exception as e:
            logger.warning("Failed to upload video to assets: %s", e)

    return DownloadVideoResponse(
        success=True,
        filename=result.filename,
        title=result.title,
        filepath=result.filepath,
        duration=result.duration,
        ext=result.ext,
        width=result.width,
        height=result.height,
        webpage_url=result.webpage_url,
        thumbnail=result.thumbnail,
        asset_url=asset_url,
    )


@router.post("/download/stream", response_model=DownloadVideoResponse)
async def download_video_stream(
    request: DownloadVideoRequest,
    user: UserContext = Depends(require_user),
):
    if not request.url.strip():
        raise HTTPException(status_code=400, detail="URL is required")

    url = request.url.strip()

    try:
        result = await video_downloader.download(url)
    except Exception as e:
        raise HTTPException(status_code=502, detail=str(e))

    asset_url: str | None = None
    if request.business_id:
        try:
            asset_url = await _upload_to_assets(result.filepath, result.filename, user.user_id, request.business_id)
        except Exception as e:
            logger.warning("Failed to upload video to assets: %s", e)

    return DownloadVideoResponse(
        success=True,
        filename=result.filename,
        title=result.title,
        filepath=result.filepath,
        duration=result.duration,
        ext=result.ext,
        width=result.width,
        height=result.height,
        webpage_url=result.webpage_url,
        thumbnail=result.thumbnail,
        asset_url=asset_url,
    )


@router.get("/file/{filename}")
async def serve_video_file(
    filename: str,
    filepath: str | None = None,
    user: UserContext = Depends(require_user),
):
    if filepath and os.path.exists(filepath):
        return FileResponse(filepath, media_type="video/mp4", filename=filename)
    raise HTTPException(status_code=404, detail="File not found")


@router.post("/analyze-transcription", response_model=AnalyzeTranscriptionResponse)
async def analyze_transcription(
    request: AnalyzeTranscriptionRequest,
    user: UserContext = Depends(require_user),
):
    if not request.transcription.strip():
        raise HTTPException(status_code=400, detail="Transcription text is required")

    try:
        result = await analysis_service.analyze_transcription(
            transcription=request.transcription,
            topic_hint=request.topic_hint,
        )
    except Exception as e:
        return AnalyzeTranscriptionResponse(
            success=False,
            error=str(e),
        )

    raw_structure = result.get("structure", [])
    structure = []
    for section in raw_structure:
        if isinstance(section, dict):
            structure.append(
                StructureSection(
                    section=section.get("section", ""),
                    content_summary=section.get("content_summary", ""),
                )
            )

    return AnalyzeTranscriptionResponse(
        success=True,
        hook_type=result.get("hook_type", ""),
        hook_text=result.get("hook_text", ""),
        estimated_hook_duration_seconds=result.get("estimated_hook_duration_seconds", 0),
        structure=structure,
        pattern=result.get("pattern", ""),
        retention_triggers=result.get("retention_triggers", []),
        cta_type=result.get("cta_type", ""),
        target_audience=result.get("target_audience", ""),
        replicable_template=result.get("replicable_template", ""),
    )


async def _upload_to_assets(
    filepath: str,
    filename: str,
    user_id: str,
    business_id: str,
) -> str | None:
    if not os.path.exists(filepath):
        return None

    nuxt_url = settings.cors_origins[0] if settings.cors_origins else "http://localhost:3000"

    try:
        async with httpx.AsyncClient(timeout=120.0) as client:
            with open(filepath, "rb") as f:
                files = {"file": (filename, f, "video/mp4")}
                resp = await client.post(
                    f"{nuxt_url}/api/v1/assets/upload",
                    data={"businessId": business_id},
                    files=files,
                    headers={"X-User-Id": user_id},
                )
                if resp.is_success:
                    data = resp.json()
                    return data.get("data", {}).get("url") or data.get("url")
    except Exception as e:
        logger.warning("Asset upload failed: %s", e)

    return None