Run a trend scan for this business, focused on one topic. The business context in your system prompt (profile, playbook, corpus) applies to every idea.

Topic: {{topic}}
Platforms: {{platformList}}
Ideas needed: exactly {{count}}
Format: {{kindHint}}
Research brief — ground every idea in this evidence; each idea must name the finding or top post it came from:
{{brief}}
Platform rules (shape every idea for these platforms):
{{platformRules}}
Call scan_trends{{scanScope}} for performance signals, then propose exactly {{count}} fresh, specific ideas and add them with board_add_cards (sourceType "trend", platforms [{{platformList}}]). Ideas written as plain text do not count — every idea must be persisted through board_add_cards. Each card brief opens with the hook and summarizes the angle in full sentences — never a bare list of links or bare URLs. Do not schedule or publish anything. Finish by listing the created card titles and ids.
