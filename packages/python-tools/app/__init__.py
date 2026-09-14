"""MagicSync Python tools service.

Optional, user-configured sidecar that exposes Python-only scraping tools
(ScrapeGraphAI and friends) over a small HTTP API the Nuxt agent calls through
the `python_tools_*` tools. Run it yourself and point MagicSync at its URL in
AI settings; nothing in the Nuxt app depends on it being present.
"""
