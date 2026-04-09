from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from app.core.security import require_user, UserContext
import base64

router = APIRouter()


class ImportZipRequest(BaseModel):
    zip_base64: str


class ImportUrlRequest(BaseModel):
    url: str


class ImportFolderRequest(BaseModel):
    folder_path: str


@router.post("/import/zip")
async def import_skill_from_zip(
    request: ImportZipRequest,
    user: UserContext = Depends(require_user),
):
    """Import a skill from a base64-encoded ZIP file."""
    from app.services.skills.tools import SkillTools

    try:
        zip_content = base64.b64decode(request.zip_base64)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Invalid base64: {e}")

    skill_tools = SkillTools(user.user_id)
    result = await skill_tools.import_skill_from_zip(zip_content)

    if "error" in result:
        raise HTTPException(status_code=400, detail=result["error"])

    return result


@router.post("/import/url")
async def import_skill_from_url(
    request: ImportUrlRequest,
    user: UserContext = Depends(require_user),
):
    """Import a skill from a URL pointing to a ZIP file."""
    from app.services.skills.tools import SkillTools

    skill_tools = SkillTools(user.user_id)
    result = await skill_tools.import_skill_from_url(request.url)

    if "error" in result:
        raise HTTPException(status_code=400, detail=result["error"])

    return result


@router.post("/import/folder")
async def import_skill_from_folder(
    request: ImportFolderRequest,
    user: UserContext = Depends(require_user),
):
    """Import a skill from a local folder path."""
    from app.services.skills.tools import SkillTools

    skill_tools = SkillTools(user.user_id)
    result = await skill_tools.import_skill_from_folder(request.folder_path)

    if "error" in result:
        raise HTTPException(status_code=400, detail=result["error"])

    return result
