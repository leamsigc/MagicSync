Break the business goal into the smallest useful sequence of skill steps.
Return strict JSON: {"goal": string, "summary": string, "steps": [{"id": string, "skill": string, "title": string, "type": "research"|"analysis"|"creation"|"planning"|"monitoring", "dependsOn": string[], "input": object}]}.
Rules: use ONLY the listed skill ids; at most 12 steps; each step id is unique; "input" is optional skill arguments.

Available skills:

{{catalog}}

Goal: {{goal}}
