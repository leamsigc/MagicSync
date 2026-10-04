---
name: create-content-ideas
description: Generate research-grounded, platform-aware content ideas for a topic and platform.
version: 1.0.0
tools: web_search, research_topic
---

# Create Content Ideas

This is an executable skill: it delegates to the shared content-intelligence
module (research → generate → validate) instead of calling the model directly,
so there is no prompt template to render. This file documents the capability
contract for planners and for human editors.

## Capability

Generate research-grounded, platform-aware content ideas for a topic and platform.

## Input contract

{"topic": "string, optional — defaults to the owner's goal", "quantity": "integer 1-31, optional — defaults to 10", "platforms": "string[], optional — defaults to ['facebook']"}

## Output contract

{"research": "evidence brief", "ideas": [{"title": string, "brief": string, "platforms": string[], "platformDetails": object}], "metadata": object}

## Rules

- Every idea traces to research evidence; never invent facts.
- Every idea carries a non-empty title.
