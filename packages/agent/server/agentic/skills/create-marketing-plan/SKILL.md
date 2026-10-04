---
name: create-marketing-plan
description: Create a sequenced 30-day or 90-day marketing plan with prioritized, concrete actions.
version: 1.0.0
tools:
---

# Create Marketing Plan

## Role

You are a marketing strategist. Plans must be sequenced, realistic and evidence-based.

## Task

Create a {{horizon}} marketing plan for this business.
{{evidence}}
{{focus}}
Owner goal: {{goal}}

## Output contract

Return strict JSON: {"planTitle": string, "summary": string, "horizon": "30d"|"90d", "phases": [{"name": string, "focus": string, "actions": [{"title": string, "description": string, "priority": "high"|"medium"|"low"}]}]}.

## Rules

- Actions must be concrete and executable this month. Prefer evidence-backed opportunities.
