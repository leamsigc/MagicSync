"""Turn questionnaire answers into a brand playbook JSON object.

Pure prompt-building plus a thin LLM call. Never raises: failures come
back as {"error": ...} so the playbook page can toast them.
"""

import json
import logging

logger = logging.getLogger(__name__)

PROVIDER_ENV_KEYS = {
    "google": "GEMINI_API_KEY",
    "openai": "OPENAI_API_KEY",
    "anthropic": "ANTHROPIC_API_KEY",
    "openrouter": "OPENROUTER_API_KEY",
    "deepseek": "DEEPSEEK_API_KEY",
}

AUTH_HELP = (
    "AI_AUTH_FAILED: no usable API key for this provider. "
    "Add your key in Account → AI settings, or switch to a local Ollama model."
)


def has_credentials(provider: str, api_key: str | None) -> bool:
    if api_key:
        return True
    if provider == "ollama":
        return True
    import os

    env_key = PROVIDER_ENV_KEYS.get(provider)
    return bool(env_key and os.environ.get(env_key))


PLAYBOOK_SHAPE = """{
  "version": 1,
  "businessName": "",
  "voice": {"tone": "", "bannedPhrases": [], "influences": []},
  "positioning": {"audience": "", "problem": "", "differentiator": ""},
  "offers": [{"name": "", "transformation": "", "price": ""}],
  "hooks": [],
  "competitors": [{"name": "", "whyWeWin": ""}],
  "testimonials": [{"quote": "", "name": "", "role": ""}],
  "keywords": {"primary": [], "secondary": []},
  "author": "",
  "ctaLinks": [{"url": "", "label": "", "whenToUse": ""}],
  "imageStyle": ""
}"""


def build_refine_prompt(
    answers: list[dict],
    draft: dict | None = None,
    business_context: str = "",
) -> str:
    answered = [
        f"[{item.get('section', 'general')}] {item.get('question', '')}\n{item.get('answer', '')}"
        for item in answers
        if str(item.get('answer', '')).strip()
    ]
    lines = [
        "You are a brand strategist. Turn the member's questionnaire answers",
        "into a brand playbook JSON object with EXACTLY this shape:",
        PLAYBOOK_SHAPE,
        "",
        "Rules:",
        "- Fill every field the answers support; leave the rest as empty defaults.",
        "- Distill, don't invent: no fabricated testimonials, prices, or names.",
        "- Keep voice/learnings from any existing draft below; answers win on conflict.",
        "- Output JSON ONLY, no code fences, no commentary.",
    ]
    if draft:
        lines += ["", "Existing draft:", json.dumps(draft)[:4000]]
    if business_context and business_context.strip():
        lines += ["", "Business context:", business_context.strip()[:2000]]
    lines += ["", "Questionnaire answers:", "\n\n".join(answered)]
    return "\n".join(lines)


def parse_playbook_json(raw: str) -> dict | None:
    text = raw.strip()
    if text.startswith("```"):
        text = text.split("\n", 1)[1] if "\n" in text else ""
        if text.rstrip().endswith("```"):
            text = text.rstrip()[:-3]
    try:
        parsed = json.loads(text)
        return parsed if isinstance(parsed, dict) else None
    except (json.JSONDecodeError, ValueError):
        return None


async def refine_answers(
    answers: list[dict],
    draft: dict | None = None,
    business_context: str = "",
    provider: str = "ollama",
    model: str = "qwen3.5",
    api_key: str | None = None,
    api_base: str | None = None,
) -> dict:
    from app.services.llm import llm_service

    usable = [a for a in answers if str(a.get("answer", "")).strip()]
    if not usable:
        return {"error": "Answer at least one question before refining."}
    if not has_credentials(provider, api_key):
        return {"error": AUTH_HELP}
    try:
        prompt = build_refine_prompt(usable, draft, business_context)
        raw = await llm_service.chat_text(
            [
                {"role": "system", "content": "You output valid JSON only."},
                {"role": "user", "content": prompt},
            ],
            provider=provider,
            model=model,
            api_key=api_key,
            api_base=api_base,
        )
        playbook = parse_playbook_json(raw)
        if playbook is None:
            return {"error": "The AI did not return valid JSON. Try again."}
        return {"playbook": playbook}
    except Exception as exc:
        logger.error(f"refine_answers failed: {exc}")
        if exc.__class__.__name__ == "AuthenticationError" or "API key not valid" in str(exc):
            return {"error": AUTH_HELP}
        return {"error": str(exc)}
