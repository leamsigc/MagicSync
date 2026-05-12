# MagicSync Python Backend - RAG Agentic System Specification

## Overview

This document specifies the design for enhancing MagicSync's Python backend with a complete RAG agentic system for social media management capabilities. The system builds upon existing infrastructure while introducing new services, tools, and API endpoints.

---

## Part 1: Existing Architecture Analysis

### 1.1 RAG Services (`app/services/rag/`)

**Capabilities:**
- `embedding_service`: Ollama-based embedding generation with batch support and semaphore-based rate limiting
- `chunk_text()`: Text chunking by paragraphs with overlap
- `chunk_structured()`: Structured page-aware chunking preserving page/section metadata
- `extract_metadata()`: LLM-based document metadata extraction (title, author, topics, summary)
- `reranker_service`: LLM-based result reranking
- `file_parser`: Multi-format document parsing (PDF, DOCX, PPTX, etc.)

**Key Patterns:**
- Token estimation: ~4 chars per token
- Chunk size: 512 tokens default, 64 token overlap
- Embedding model: configurable via settings

### 1.2 Agent Services (`app/services/agent/`)

**SubAgent Service:**
- Isolated context per agent with lifecycle management
- Spawn/Start/Complete/Fail state machine
- Tool call parsing: `[TOOL:tool-name] {"key": "value"}` format
- Multi-step execution with configurable max steps

**Agent Orchestrator:**
- Keyword-based spawn decision logic
- Task type detection: research, analysis, multi-step, complex
- Confidence scoring for spawn decisions

**DeepMode Agent:**
- Autonomous planning with todo list
- Workspace file management
- Sub-agent delegation
- User input handling

**Workspace Service:**
- Virtual filesystem per thread/user
- File CRUD operations stored in Turso
- MIME type tracking

### 1.3 Tool System (`app/services/tools/`)

**ToolRegistry:**
- Dynamic tool registration with categories
- Keyword/regex-based search
- OpenAI function calling format export
- Usage statistics tracking

**ToolExecutor:**
- Pattern matching for tool invocation
- Keyword-based detection fallback
- Result formatting for LLM context

**KnowledgeBaseTools:**
- `kb_ls`: List documents in folder
- `kb_tree`: Hierarchical folder tree
- `kb_grep`: Pattern search with FTS
- `kb_glob`: Filename pattern matching
- `kb_read`: Full document retrieval

### 1.4 Skills System (`app/services/skills/`)

**SkillTools:**
- Load/save/list skills with user isolation
- agentskills.io ZIP format import
- URL and folder-based import
- Skill file attachments support

**CodeSandbox:**
- Sandboxed Python execution
- Tool stub injection for LLM code generation
- Auto-wrap expressions in print()

### 1.5 Harness System (`app/services/harness/`)

**HarnessEngine:**
- Phase-based workflow execution
- Phase types: programmatic, LLM single, LLM agent, batch agents, human input
- State persistence to Turso
- Default harnesses: contract_review, document_analysis, research

**Phase Executors:**
- `ProgrammaticExecutor`: Pure Python handlers
- `LLMSingleExecutor`: Single LLM call with structured output
- `LLMAgentExecutor`: Multi-round agent loop
- `LLMBatchAgentsExecutor`: Parallel batch processing
- `LLMWaitUserExecutor`: Pause for user interaction

### 1.6 LLM Service (`app/services/llm/`)

**LLMService (via LiteLLM):**
- Unified interface for Ollama, OpenAI, Anthropic, OpenRouter, Google
- Streaming and non-streaming completion
- Token usage tracking
- Cost logging via callbacks
- Model formatting per provider

### 1.7 API Endpoints (`app/api/v1/`)

**Current Routes:**
- `POST /chat`: Streaming chat with tool execution
- `POST /chat/complete`: Non-streaming completion
- `POST /rag/ingest`: Document ingestion with SSE progress
- `POST /rag/retrieve`: Query embedding generation
- `POST /rag/extract-metadata`: Document metadata extraction
- `POST /rag/hybrid-search`: Hybrid search endpoint
- `POST /rag/rerank`: Result reranking
- `POST /agent/spawn`: Sub-agent spawning
- `GET /agent`: List agents
- `POST /agent/{id}/step`: Execute agent step
- `POST /agent/{id}/stream`: SSE agent streaming
- `GET /agent/{id}/status`: Agent status
- `POST /agent/detect`: Spawn decision detection
- `POST /skills/import/zip|url|folder`: Skill import

---

## Part 2: Enhanced System Design

### 2.1 New Service Architecture

```
app/services/
├── social/                    # NEW: Social media services
│   ├── __init__.py
│   ├── outreach.py            # DM drafting, comment replies
│   ├── post_creator.py        # Multi-platform post generation
│   ├── monitor.py             # Mention tracking, trend detection
│   ├── scheduler.py           # Bulk scheduling, queue management
│   ├── video.py               # Thumbnail, scripting, captions
│   └── engagement.py          # Auto-like, response drafts, hashtags
├── social_rag/               # NEW: Social content RAG
│   ├── __init__.py
│   ├── content_indexer.py    # Social post indexing
│   ├── platform_formatter.py  # Platform-specific formatting
│   └── engagement_history.py  # User interaction history
├── persona/                   # NEW: Brand/user persona system
│   ├── __init__.py
│   ├── persona_store.py       # Persona CRUD
│   ├── tone_analyzer.py       # Writing style analysis
│   └── personalization.py     # Content personalization
└── social_harness/           # NEW: Social media harnesses
    ├── __init__.py
    └── harnesses/
        ├── content_campaign.py
        ├── engagement_flow.py
        └── monitoring_alert.py
```

### 2.2 Social Content Service (`app/services/social/outreach.py`)

**OutreachService:**

```python
class OutreachService:
    """Handles social outreach: DMs, comment replies, auto-engagement."""
    
    async def draft_dm(
        self,
        user_id: str,
        recipient: dict,
        context: str,
        tone: str = "professional",
        platform: str = "twitter"
    ) -> dict:
        """Draft a direct message based on context and recipient profile."""
    
    async def draft_comment_reply(
        self,
        user_id: str,
        original_comment: str,
        post_context: str,
        platform: str
    ) -> dict:
        """Generate a comment reply draft."""
    
    async def generate_engagement_message(
        self,
        user_id: str,
        target_profile: dict,
        action: str  # follow, like, retweet, reply
    ) -> dict:
        """Generate personalized engagement message."""
```

### 2.3 Post Creation Service (`app/services/social/post_creator.py`)

**PostCreatorService:**

```python
PLATFORM_LIMITS = {
    "twitter": {"max_chars": 280, "max_images": 4},
    "linkedin": {"max_chars": 3000, "max_images": 9},
    "instagram": {"max_chars": 2200, "max_images": 10},
    "facebook": {"max_chars": 63206, "max_images": 10},
    "threads": {"max_chars": 500, "max_images": 10},
    "tiktok": {"max_chars": 2200, "max_images": 0},
}

class PostCreatorService:
    """Multi-platform social media post creation."""
    
    async def create_post(
        self,
        user_id: str,
        content: str,
        platforms: list[str],
        media: list[dict] | None = None,
        brand_persona: str | None = None,
        custom_instructions: str | None = None
    ) -> dict:
        """Create platform-optimized posts from base content."""
    
    async def create_from_template(
        self,
        user_id: str,
        template_id: str,
        variables: dict,
        platforms: list[str]
    ) -> dict:
        """Fill a content template with variables."""
    
    async def adapt_existing_post(
        self,
        user_id: str,
        original_post: str,
        source_platform: str,
        target_platforms: list[str]
    ) -> dict:
        """Adapt an existing post for different platforms."""
    
    async def generate_hashtags(
        self,
        user_id: str,
        content: str,
        platform: str,
        count: int = 5,
        trending: bool = False
    ) -> dict:
        """Generate relevant hashtags for content."""
```

### 2.4 Monitoring Service (`app/services/social/monitor.py`)

**MonitoringService:**

```python
class MonitoringService:
    """Mention tracking, trend detection, and alert system."""
    
    async def track_mentions(
        self,
        user_id: str,
        keywords: list[str],
        time_range: str = "24h"
    ) -> dict:
        """Track mentions of keywords across platforms."""
    
    async def detect_trends(
        self,
        user_id: str,
        industry: str | None = None,
        limit: int = 10
    ) -> dict:
        """Detect trending topics in user's industry."""
    
    async def create_alert(
        self,
        user_id: str,
        alert_config: dict
    ) -> dict:
        """Create a monitoring alert."""
    
    async def check_alerts(
        self,
        user_id: str
    ) -> dict:
        """Check all active alerts and return triggered ones."""
```

### 2.5 Scheduler Service (`app/services/social/scheduler.py`)

**SchedulerService:**

```python
class ScheduleStatus(str, Enum):
    DRAFT = "draft"
    SCHEDULED = "scheduled"
    PUBLISHED = "published"
    FAILED = "failed"

class SchedulerService:
    """Bulk scheduling, queue management, and posting."""
    
    async def create_schedule(
        self,
        user_id: str,
        posts: list[dict],
        schedule_config: dict  # cron or intervals
    ) -> dict:
        """Create a bulk posting schedule."""
    
    async def queue_post(
        self,
        user_id: str,
        post: dict,
        publish_at: datetime | None = None
    ) -> dict:
        """Add a post to the publishing queue."""
    
    async def generate_batch_from_template(
        self,
        user_id: str,
        template: dict,
        batch_size: int,
        date_range: tuple[datetime, datetime]
    ) -> dict:
        """Generate batch posts from a single template."""
    
    async def get_queue_status(
        self,
        user_id: str
    ) -> dict:
        """Get current queue status and upcoming posts."""
```

### 2.6 Video Service (`app/services/social/video.py`)

**VideoService:**

```python
class VideoService:
    """Video content generation: thumbnails, scripts, captions."""
    
    async def generate_thumbnail_suggestions(
        self,
        user_id: str,
        video_topic: str,
        style: str = "engaging"
    ) -> dict:
        """Generate thumbnail concepts and prompts."""
    
    async def script_short_form_video(
        self,
        user_id: str,
        topic: str,
        duration: int,  # seconds
        platform: str,  # tiktok, instagram_reels, youtube_shorts
        hook_style: str = "attention_grabbing"
    ) -> dict:
        """Script a short-form video with hook, body, CTA."""
    
    async def generate_captions(
        self,
        user_id: str,
        video_description: str,
        platform: str,
        style: str = "default"  # default, funny, aesthetic
    ) -> dict:
        """Generate video captions based on description."""
```

### 2.7 Engagement Service (`app/services/social/engagement.py`)

**EngagementService:**

```python
class EngagementService:
    """Auto-engagement features: likes, responses, hashtag suggestions."""
    
    async def suggest_auto_like_targets(
        self,
        user_id: str,
        criteria: dict
    ) -> dict:
        """Suggest posts to auto-like based on criteria."""
    
    async def draft_comment_response(
        self,
        user_id: str,
        comment: str,
        post_topic: str,
        sentiment: str  # positive, neutral, negative
    ) -> dict:
        """Draft an automated comment response."""
    
    async def suggest_hashtags_for_post(
        self,
        user_id: str,
        content: str,
        platform: str,
        include_trending: bool = True
    ) -> dict:
        """Suggest hashtags for a specific post."""
```

---

## Part 3: Data Layer Design

### 3.1 User Data for Personalization

**User Persona Table:**
```sql
CREATE TABLE user_personas (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    name TEXT NOT NULL,
    brand_voice TEXT,           -- Professional, casual, humorous, etc.
    target_audience TEXT,        -- JSON array of audience segments
    industry TEXT,
    content_style TEXT,          -- Inspirational, educational, promotional, etc.
    banned_words TEXT,           -- Comma-separated banned terms
    preferred_topics TEXT,       -- JSON array of interests
    bio_context TEXT,           -- Long-form brand description for RAG
    created_at INTEGER,
    updated_at INTEGER
);
```

**User Social Profiles Table:**
```sql
CREATE TABLE user_social_profiles (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    platform TEXT NOT NULL,      -- twitter, linkedin, instagram, etc.
    handle TEXT,
    access_token_encrypted TEXT,
    refresh_token_encrypted TEXT,
    settings TEXT,               -- JSON platform-specific settings
    connected INTEGER DEFAULT 0,
    last_sync_at INTEGER,
    created_at INTEGER,
    FOREIGN KEY (user_id) REFERENCES users(id)
);
```

### 3.2 Embeddings for Social Content

**Social Content Embeddings:**
```sql
CREATE TABLE social_content_embeddings (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    content_id TEXT NOT NULL,
    platform TEXT NOT NULL,
    content_type TEXT,           -- post, comment, dm, script
    embedding BLOB,              -- Vector blob
    content_text TEXT,           -- Original content
    metadata TEXT,               -- JSON with engagement stats, etc.
    created_at INTEGER,
    updated_at INTEGER
);
```

**Engagement History Embeddings:**
```sql
CREATE TABLE engagement_history_embeddings (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    interaction_type TEXT,       -- liked, commented, shared, replied
    target_content TEXT,
    target_platform TEXT,
    target_author TEXT,
    target_hashtags TEXT,
    engagement_success INTEGER,  -- Did it achieve goals?
    embedding BLOB,
    created_at INTEGER
);
```

### 3.3 RAG Integration

**Persona-Aware RAG Context:**
```python
async def retrieve_personalized_context(
    user_id: str,
    query: str,
    persona_id: str | None = None,
    top_k: int = 5
) -> dict:
    """Retrieve RAG context personalized for user/brand."""
    
    # 1. Load user persona if not provided
    if not persona_id:
        persona = await persona_store.get_default_persona(user_id)
    else:
        persona = await persona_store.get_persona(persona_id)
    
    # 2. Generate query embedding
    query_embedding = await embedding_service.embed(
        f"{query} {persona.brand_voice} {persona.industry}"
    )
    
    # 3. Search user content + brand guidelines
    results = await search_user_content(
        user_id, query_embedding, top_k
    )
    
    # 4. Search engagement history for style
    style_results = await search_engagement_history(
        user_id, query_embedding, top_k=3
    )
    
    # 5. Combine and return personalized context
    return {
        "relevant_content": results,
        "style_reference": style_results,
        "persona": persona,
        "personalization_hints": generate_personalization_prompt(persona)
    }
```

---

## Part 4: API Endpoints Design

### 4.1 Social Outreach Endpoints

```
POST /api/v1/social/outreach/draft-dm
Request: {
    "recipient_handle": "string",
    "recipient_profile": {},  // Optional context
    "context": "string",
    "tone": "professional|casual|friendly",
    "platform": "twitter|linkedin|instagram"
}
Response: {
    "draft": "string",
    "variations": ["string"],
    "character_count": 123,
    "platform_limit": 280
}

POST /api/v1/social/outreach/draft-comment
Request: {
    "original_comment": "string",
    "post_context": "string",
    "platform": "string",
    "tone": "string"
}
Response: {
    "drafts": [{
        "text": "string",
        "sentiment": "string",
        "engagement_score": 0.85
    }]
}

POST /api/v1/social/outreach/engagement-message
Request: {
    "target_handle": "string",
    "target_profile": {},
    "action": "follow|like|retweet|reply"
}
Response: {
    "message": "string",
    "action_type": "string"
}
```

### 4.2 Post Creation Endpoints

```
POST /api/v1/social/posts/create
Request: {
    "content": "string",
    "platforms": ["twitter", "linkedin", "instagram"],
    "media": [{"url": "string", "type": "image|video"}],
    "brand_persona_id": "string",
    "custom_instructions": "string",
    "include_hashtags": true,
    "auto_schedule": false,
    "schedule_time": "ISO8601"
}
Response: {
    "posts": [{
        "platform": "string",
        "content": "string",
        "character_count": 123,
        "within_limit": true,
        "hashtags": ["string"],
        "media_slots_available": 4
    }],
    "total_posts": 3
}

POST /api/v1/social/posts/adapt
Request: {
    "original_post": "string",
    "source_platform": "string",
    "target_platforms": ["string"],
    "preserve_hashtags": true
}
Response: {
    "adapted_posts": [{
        "platform": "string",
        "content": "string",
        "changes_made": ["reduced_characters", "added_cta"]
    }]
}

POST /api/v1/social/posts/templates
GET  /api/v1/social/posts/templates
POST /api/v1/social/posts/templates/{id}/fill
```

### 4.3 Monitoring Endpoints

```
POST /api/v1/social/monitor/mentions
Request: {
    "keywords": ["string"],
    "platforms": ["string"],
    "time_range": "1h|24h|7d|30d",
    "include_sentiment": true
}
Response: {
    "mentions": [{
        "keyword": "string",
        "source": "string",
        "content": "string",
        "sentiment": "positive|neutral|negative",
        "timestamp": "ISO8601"
    }],
    "summary": {
        "total_mentions": 123,
        "sentiment_breakdown": {}
    }
}

POST /api/v1/social/monitor/trends
Request: {
    "industry": "string",
    "limit": 10,
    "include_related": true
}
Response: {
    "trends": [{
        "topic": "string",
        "volume": 12345,
        "velocity": "rising|stable|declining",
        "related_hashtags": ["string"]
    }]
}

POST /api/v1/social/monitor/alerts
GET  /api/v1/social/monitor/alerts
DELETE /api/v1/social/monitor/alerts/{id}
```

### 4.4 Scheduler Endpoints

```
POST /api/v1/social/schedule/queue
Request: {
    "posts": [{
        "content": "string",
        "platform": "string",
        "media": [],
        "custom_post_data": {}
    }],
    "schedule_config": {
        "type": "cron|interval|optimal",
        "cron": "0 9 * * *",  // Optional
        "interval_hours": 4,   // Optional
        "optimal_times": [{"platform": "twitter", "times": ["09:00", "12:00"]}]
    }
}
Response: {
    "schedule_id": "string",
    "posts_queued": 25,
    "first_post_at": "ISO8601",
    "last_post_at": "ISO8601"
}

GET  /api/v1/social/schedule/status
GET  /api/v1/social/schedule/queue
PUT  /api/v1/social/schedule/post/{id}
DELETE /api/v1/social/schedule/post/{id}

POST /api/v1/social/schedule/batch-template
Request: {
    "template": {
        "content": "Our {product} is now available! Check out {link}",
        "variables": {
            "product": ["Widget A", "Widget B"],
            "link": ["https://example.com/a", "https://example.com/b"]
        }
    },
    "platforms": ["twitter", "linkedin"],
    "date_range": {
        "start": "ISO8601",
        "end": "ISO8601"
    },
    "spacing_hours": 24
}
```

### 4.5 Video Content Endpoints

```
POST /api/v1/social/video/thumbnail-suggestions
Request: {
    "video_topic": "string",
    "style": "engaging|professional|humorous",
    "count": 3
}
Response: {
    "suggestions": [{
        "title": "string",
        "description": "string",
        "visual_elements": ["string"],
        "prompt_for_ai": "string"
    }]
}

POST /api/v1/social/video/script
Request: {
    "topic": "string",
    "duration_seconds": 60,
    "platform": "tiktok|instagram_reels|youtube_shorts",
    "hook_style": "attention_grabbing|curiosity|emotional",
    "cta": "string"
}
Response: {
    "script": {
        "hook": "string",
        "body": ["string"],
        "cta": "string",
        "estimated_duration": 58,
        "text_overlays": ["string"]
    },
    " filming_tips": ["string"]
}

POST /api/v1/social/video/captions
Request: {
    "video_description": "string",
    "platform": "string",
    "style": "default|funny|aesthetic|minimal",
    "max_length": 100
}
Response: {
    "captions": [{
        "text": "string",
        "style": "string",
        "emoji_count": 3
    }]
}
```

### 4.6 Engagement Endpoints

```
POST /api/v1/social/engagement/auto-like-suggestions
Request: {
    "criteria": {
        "keywords": ["string"],
        "excluded_keywords": ["string"],
        "min_engagement": 100,
        "platforms": ["string"]
    },
    "limit": 20
}

POST /api/v1/social/engagement/comment-response
Request: {
    "comment": "string",
    "post_topic": "string",
    "sentiment": "positive|neutral|negative",
    "platform": "string"
}
Response: {
    "response": "string",
    "alternatives": ["string"],
    "sentiment_match": 0.92
}

POST /api/v1/social/engagement/hashtag-suggestions
Request: {
    "content": "string",
    "platform": "string",
    "count": 5,
    "include_trending": true
}
Response: {
    "hashtags": [{
        "tag": "string",
        "relevance_score": 0.95,
        "is_trending": true,
        "volume_estimate": 10000
    }]
}
```

---

## Part 5: Workflow System (Harness) Design

### 5.1 Content Campaign Harness

```python
CONTENT_CAMPAIGN_HARNESS = [
    {
        "name": "Brief Analysis",
        "type": PhaseType.LLM_SINGLE,
        "system_prompt": "You are a social media campaign strategist.",
        "prompt": "Analyze this campaign brief and extract key themes, goals, and target audience.",
    },
    {
        "name": "Generate Post Ideas",
        "type": PhaseType.LLM_BATCH_AGENTS,
        "context": {"max_steps": 5},
    },
    {
        "name": "Personalize Content",
        "type": PhaseType.PROGRAMMATIC,
        "handler": "apply_persona_styles",
    },
    {
        "name": "Create Platform Variants",
        "type": PhaseType.LLM_SINGLE,
        "system_prompt": "You are a multi-platform social media expert.",
    },
    {
        "name": "Generate Hashtags",
        "type": PhaseType.LLM_SINGLE,
        "handler": "generate_platform_hashtags",
    },
    {
        "name": "Schedule Posts",
        "type": PhaseType.PROGRAMMATIC,
        "handler": "queue_scheduled_posts",
    },
    {
        "name": "Campaign Summary",
        "type": PhaseType.LLM_SINGLE,
        "schema": "campaign_summary",
    },
]
```

### 5.2 Engagement Flow Harness

```python
ENGAGEMENT_FLOW_HARNESS = [
    {
        "name": "Monitor Mentions",
        "type": PhaseType.PROGRAMMATIC,
        "handler": "fetch_brand_mentions",
    },
    {
        "name": "Sentiment Analysis",
        "type": PhaseType.LLM_BATCH_AGENTS,
        "context": {"max_steps": 3},
    },
    {
        "name": "Generate Responses",
        "type": PhaseType.LLM_SINGLE,
        "system_prompt": "You craft personalized engagement responses.",
    },
    {
        "name": "Review Required",
        "type": PhaseType.LLM_HUMAN_INPUT,
    },
    {
        "name": "Execute Engagement",
        "type": PhaseType.PROGRAMMATIC,
        "handler": "execute_pending_engagements",
    },
]
```

### 5.3 Monitoring Alert Harness

```python
MONITORING_ALERT_HARNESS = [
    {
        "name": "Check Alert Conditions",
        "type": PhaseType.PROGRAMMATIC,
        "handler": "evaluate_alert_conditions",
    },
    {
        "name": "Trend Analysis",
        "type": PhaseType.LLM_SINGLE,
        "system_prompt": "You analyze social media trends and patterns.",
    },
    {
        "name": "Generate Alert Report",
        "type": PhaseType.LLM_SINGLE,
        "schema": "alert_report",
    },
    {
        "name": "Notify Stakeholders",
        "type": PhaseType.PROGRAMMATIC,
        "handler": "send_alert_notifications",
    },
]
```

---

## Part 6: Tool System Extensions

### 6.1 New Tool Definitions

```python
SOCIAL_MEDIA_TOOLS = [
    {
        "name": "draft_social_dm",
        "description": "Draft a personalized direct message for social outreach.",
        "parameters": {
            "type": "object",
            "properties": {
                "recipient_handle": {"type": "string"},
                "context": {"type": "string"},
                "tone": {"type": "string", "enum": ["professional", "casual", "friendly"]},
                "platform": {"type": "string"}
            },
            "required": ["recipient_handle", "context", "platform"]
        }
    },
    {
        "name": "create_platform_post",
        "description": "Create optimized social media post content for multiple platforms.",
        "parameters": {
            "type": "object",
            "properties": {
                "content": {"type": "string"},
                "platforms": {"type": "array", "items": {"type": "string"}},
                "brand_persona_id": {"type": "string"},
                "include_hashtags": {"type": "boolean", "default": True}
            },
            "required": ["content", "platforms"]
        }
    },
    {
        "name": "generate_video_script",
        "description": "Generate a script for short-form video content.",
        "parameters": {
            "type": "object",
            "properties": {
                "topic": {"type": "string"},
                "duration_seconds": {"type": "integer"},
                "platform": {"type": "string"},
                "hook_style": {"type": "string"}
            },
            "required": ["topic", "duration_seconds", "platform"]
        }
    },
    {
        "name": "track_social_mentions",
        "description": "Track mentions of keywords or brand across social platforms.",
        "parameters": {
            "type": "object",
            "properties": {
                "keywords": {"type": "array", "items": {"type": "string"}},
                "time_range": {"type": "string"},
                "platforms": {"type": "array", "items": {"type": "string"}}
            },
            "required": ["keywords"]
        }
    },
    {
        "name": "schedule_social_posts",
        "description": "Schedule multiple posts for optimal publishing times.",
        "parameters": {
            "type": "object",
            "properties": {
                "posts": {"type": "array"},
                "schedule_config": {"type": "object"}
            },
            "required": ["posts", "schedule_config"]
        }
    },
    {
        "name": "get_brand_persona",
        "description": "Get the brand persona for content personalization.",
        "parameters": {
            "type": "object",
            "properties": {
                "persona_id": {"type": "string"}
            }
        }
    },
    {
        "name": "analyze_content_performance",
        "description": "Analyze past content performance for optimization insights.",
        "parameters": {
            "type": "object",
            "properties": {
                "platform": {"type": "string"},
                "time_range": {"type": "string"},
                "metrics": {"type": "array"}
            },
            "required": ["platform"]
        }
    }
]
```

### 6.2 Tool Integration

```python
# In ToolManager.execute_tool()
async def execute_tool(self, tool_name: str, arguments: dict) -> dict:
    # ... existing tool handlers ...
    
    if tool_name == "draft_social_dm":
        return await self._execute_draft_social_dm(arguments)
    if tool_name == "create_platform_post":
        return await self._execute_create_platform_post(arguments)
    if tool_name == "generate_video_script":
        return await self._execute_generate_video_script(arguments)
    if tool_name == "track_social_mentions":
        return await self._execute_track_social_mentions(arguments)
    if tool_name == "schedule_social_posts":
        return await self._execute_schedule_social_posts(arguments)
    if tool_name == "get_brand_persona":
        return await self._execute_get_brand_persona(arguments)
    if tool_name == "analyze_content_performance":
        return await self._execute_analyze_content_performance(arguments)
```

---

## Part 7: Implementation Phases

### Phase 1: Core Foundation
- [ ] Social media services module structure
- [ ] Persona system (store, analyzer)
- [ ] Basic post creation service
- [ ] Platform limit constants
- [ ] New database tables

### Phase 2: RAG Integration
- [ ] Social content indexer
- [ ] User content embedding pipeline
- [ ] Persona-aware retrieval
- [ ] Engagement history tracking

### Phase 3: API Endpoints
- [ ] Post creation endpoints
- [ ] Persona management endpoints
- [ ] Template system endpoints
- [ ] Scheduler endpoints

### Phase 4: Advanced Features
- [ ] Outreach service (DM, comments)
- [ ] Monitoring service
- [ ] Video content service
- [ ] Engagement service

### Phase 5: Workflow Integration
- [ ] Social harnesses registration
- [ ] Phase executor implementations
- [ ] State persistence

### Phase 6: Tool System
- [ ] Social media tools registration
- [ ] Tool manager integration
- [ ] Chat API integration

---

## Part 8: Database Schema Summary

```sql
-- User Personas
CREATE TABLE user_personas (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    name TEXT NOT NULL,
    brand_voice TEXT,
    target_audience TEXT,
    industry TEXT,
    content_style TEXT,
    banned_words TEXT,
    preferred_topics TEXT,
    bio_context TEXT,
    created_at INTEGER,
    updated_at INTEGER,
    FOREIGN KEY (user_id) REFERENCES users(id)
);

-- Social Profiles
CREATE TABLE user_social_profiles (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    platform TEXT NOT NULL,
    handle TEXT,
    access_token_encrypted TEXT,
    settings TEXT,
    connected INTEGER DEFAULT 0,
    last_sync_at INTEGER,
    created_at INTEGER,
    FOREIGN KEY (user_id) REFERENCES users(id)
);

-- Social Content
CREATE TABLE social_content (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    platform TEXT NOT NULL,
    content_type TEXT,
    content_text TEXT,
    media_urls TEXT,
    status TEXT,
    scheduled_at INTEGER,
    published_at INTEGER,
    engagement_stats TEXT,
    metadata TEXT,
    created_at INTEGER,
    updated_at INTEGER,
    FOREIGN KEY (user_id) REFERENCES users(id)
);

-- Content Embeddings
CREATE TABLE social_content_embeddings (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    content_id TEXT NOT NULL,
    platform TEXT NOT NULL,
    content_type TEXT,
    embedding BLOB,
    content_text TEXT,
    metadata TEXT,
    created_at INTEGER,
    updated_at INTEGER
);

-- Engagement History
CREATE TABLE engagement_history (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    interaction_type TEXT,
    target_content TEXT,
    target_platform TEXT,
    target_author TEXT,
    engagement_success INTEGER,
    created_at INTEGER,
    FOREIGN KEY (user_id) REFERENCES users(id)
);

-- Engagement Embeddings
CREATE TABLE engagement_history_embeddings (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    interaction_type TEXT,
    embedding BLOB,
    target_content TEXT,
    engagement_success INTEGER,
    created_at INTEGER
);

-- Monitoring Alerts
CREATE TABLE social_alerts (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    alert_type TEXT,
    config TEXT,
    is_active INTEGER DEFAULT 1,
    last_checked_at INTEGER,
    created_at INTEGER,
    updated_at INTEGER
);

-- Content Templates
CREATE TABLE social_templates (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    name TEXT NOT NULL,
    template_content TEXT,
    variables TEXT,
    platform TEXT,
    created_at INTEGER,
    updated_at INTEGER
);

-- Post Schedules
CREATE TABLE post_schedules (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    status TEXT,
    schedule_config TEXT,
    next_run_at INTEGER,
    last_run_at INTEGER,
    created_at INTEGER,
    updated_at INTEGER
);

-- Vector Index (Turso supports vector32)
CREATE VIRTUAL TABLE social_content_fts USING fts5(
    content_text,
    content_id UNINDEXED,
    user_id UNINDEXED
);
```

---

## Part 9: Configuration

### Environment Variables

```bash
# Social Media API Keys (optional - for live integrations)
TWITTER_API_KEY=
TWITTER_API_SECRET=
LINKEDIN_CLIENT_ID=
LINKEDIN_CLIENT_SECRET=

# Social Monitoring
BRANDWATCH_API_KEY=
MENTION_API_KEY=

# Video Services
REPLICATE_API_TOKEN=

# Default Settings
DEFAULT_PLATFORM_LIMITS={"twitter": 280, "linkedin": 3000}
MAX_HASHTAGS_PER_POST=10
ENGAGEMENT_AUTO_LIKE_ENABLED=false
```

### Settings Extension

```python
# app/core/config.py extension
class Settings(BaseSettings):
    # ... existing settings ...
    
    # Social Media
    twitter_api_key: str | None = None
    twitter_api_secret: str | None = None
    linkedin_client_id: str | None = None
    linkedin_client_secret: str | None = None
    
    # Defaults
    default_platform_limits: dict = {"twitter": 280, "linkedin": 3000}
    max_hashtags_per_post: int = 10
    engagement_auto_like_enabled: bool = False
```

---

## Part 10: Error Handling

### Error Codes

| Code | Name | Description |
|------|------|-------------|
| 400 | INVALID_PLATFORM | Platform not supported |
| 400 | CONTENT_TOO_LONG | Content exceeds platform limit |
| 400 | MISSING_PERSONA | Brand persona not found |
| 401 | SOCIAL_NOT_CONNECTED | Social account not linked |
| 429 | RATE_LIMITED | Platform API rate limit hit |
| 500 | PLATFORM_API_ERROR | External API failure |
| 500 | EMBEDDING_FAILED | Content embedding failed |

### Retry Strategy

```python
RETRY_CONFIG = {
    "max_attempts": 3,
    "backoff_multiplier": 2,
    "initial_delay_ms": 1000,
    "max_delay_ms": 10000,
}
```

---

## Part 11: Testing Strategy

### Unit Tests
- Service methods with mocked dependencies
- Platform formatter with various content lengths
- Persona personalization logic
- Hashtag generation

### Integration Tests
- Database operations
- LLM service calls
- API endpoint responses

### E2E Tests
- Full post creation workflow
- Schedule execution
- Multi-platform publishing

---

## Appendix A: Platform-Specific Details

### Twitter/X
- Character limit: 280 (with note about upcoming changes)
- Images: Up to 4
- Thread support: Yes
- Quote tweets: Yes

### LinkedIn
- Character limit: 3000
- Images: Up to 9
- Articles: Up to 50,000 characters
- Document support: PDF, Word, PowerPoint

### Instagram
- Caption limit: 2200 characters
- Image limit: 10 per carousel
- Video: 3-60 seconds (feed), 60-90 (reels)
- Stories: 15 seconds per segment

### Facebook
- Character limit: 63,206
- Image limit: 10 per post
- Video limit: 4GB or 240 minutes

### TikTok
- Caption limit: 2200 characters
- Video length: 15 seconds to 10 minutes
- Duet/Stitch support: Yes

### Threads
- Character limit: 500
- No link previews
- No hashtags as separate entities

---

## Appendix B: Skill System Integration

Social media skills follow the existing `agentskills.io` format:

```
social-content-creator/
├── SKILL.md
└── examples/
    ├── engagement-campaign.yaml
    └── viral-thread-template.md
```

**SKILL.md Example:**
```markdown
---
name: viral-thread-creator
description: Create engaging Twitter threads that drive viral engagement
---

# Viral Thread Creator

You specialize in creating Twitter threads that capture attention and drive engagement.

## Thread Structure
1. Hook (first tweet) - Must grab attention in 1 second
2. Value tweets - Provide actionable insights
3. CTA tweet - End with engagement prompt

## Thread Rules
- Keep each tweet under 260 characters
- Use numbered lists for clarity
- Include relevant statistics
- End with a question to drive replies

## Example
[Thread example content...]
```
