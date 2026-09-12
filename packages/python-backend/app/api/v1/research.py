import logging

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from app.core.security import UserContext, require_user
from app.schemas.research import ResearchRequest, ResearchResponse
from app.services.research import check_all, format_report
from app.services.research.refine import refine_answers
from app.services.research.runner import run_research

logger = logging.getLogger(__name__)

router = APIRouter()


@router.get("/doctor")
async def research_doctor(user: UserContext = Depends(require_user)):
    results = check_all()
    logger.info(f"Research doctor checked for user {user.user_id}")
    return {"channels": results, "report": format_report(results)}


class RefineAnswer(BaseModel):
    section: str = "general"
    question: str = ""
    answer: str = ""


class RefinePlaybookRequest(BaseModel):
    answers: list[RefineAnswer]
    draft: dict | None = None
    business_context: str = ""


@router.post("/refine-playbook")
async def refine_playbook(
    request: RefinePlaybookRequest,
    user: UserContext = Depends(require_user),
):
    """Refine questionnaire answers into a brand playbook JSON object."""
    if not request.answers:
        raise HTTPException(status_code=400, detail="answers must not be empty")
    cfg = user.llm_config
    result = await refine_answers(
        [item.model_dump() for item in request.answers],
        draft=request.draft,
        business_context=request.business_context,
        provider=cfg.provider,
        model=cfg.model,
        api_key=cfg.api_key,
        api_base=cfg.api_base,
    )
    if "error" in result:
        raise HTTPException(status_code=502, detail=result["error"])
    logger.info(f"Playbook refined for user {user.user_id}")
    return result


@router.post("/run", response_model=ResearchResponse)
async def run_research_endpoint(
    request: ResearchRequest,
    user: UserContext = Depends(require_user),
):
    """Bounded research run over KB documents and approved URLs (T50)."""
    cfg = user.llm_config
    result = await run_research(
        request,
        user.user_id,
        {
            "provider": cfg.provider,
            "model": cfg.model,
            "api_key": cfg.api_key,
            "api_base": cfg.api_base,
        },
    )
    logger.info(
        "Research run %s for user %s: %d sources, %d warnings",
        result.research_id,
        user.user_id,
        len(result.sources),
        len(result.warnings),
    )
    return result
