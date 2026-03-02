type HookInput = { name: string; template: string }

type CheckHookHealthParams = {
    topic: string
    hookName: string
    hooks: HookInput[]
    script: string
}

const useGrowthStrategyService = () => {
    const checkHookHealth = async ({ topic, hookName, hooks, script }: CheckHookHealthParams) => {
        const apiKey = process.env.GEMINI_API_KEY
        if (!apiKey) {
            throw createError({ statusCode: 500, statusMessage: 'GEMINI_API_KEY is not configured.' })
        }

        const hooksList = hooks.map(h => `- ${h.name}: ${h.template}`).join('\n')

        const prompt = `Analyze this video script based on the chosen hook type "${hookName}" and the topic "${topic}".
The most important metric is retention, where >90% is highly desired.

Available hooks in the user's library:
${hooksList}

1. Provide an improved version of the script for the CURRENT hook that applies your suggested adjustments to maximize retention.
2. Identify the top 3 OTHER hooks (from the library or new ones) that would work even better for this topic and script.
3. For each of those top 3 hooks, provide a full rewritten version of the script and predict its retention.

Script:
${script}`

        const response = await $fetch<{ candidates: { content: { parts: { text: string }[] } }[] }>(
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
            {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: {
                    contents: [{ parts: [{ text: prompt }] }],
                    generationConfig: {
                        responseMimeType: 'application/json',
                        responseSchema: {
                            type: 'OBJECT',
                            properties: {
                                overallScore: { type: 'NUMBER', description: 'Health score from 0 to 100' },
                                metrics: {
                                    type: 'OBJECT',
                                    properties: {
                                        hookStrength: { type: 'NUMBER' },
                                        relevance: { type: 'NUMBER' },
                                        retention: { type: 'NUMBER', description: '0 to 100 estimated retention probability. >90 is desired.' },
                                    },
                                },
                                feedback: { type: 'STRING' },
                                adjustments: { type: 'ARRAY', items: { type: 'STRING' } },
                                improvedScript: { type: 'STRING' },
                                alternativeVersions: {
                                    type: 'ARRAY',
                                    items: {
                                        type: 'OBJECT',
                                        properties: {
                                            hookName: { type: 'STRING' },
                                            predictedRetention: { type: 'NUMBER' },
                                            reasoning: { type: 'STRING' },
                                            script: { type: 'STRING' },
                                        },
                                        required: ['hookName', 'predictedRetention', 'reasoning', 'script'],
                                    },
                                },
                            },
                            required: ['overallScore', 'metrics', 'feedback', 'adjustments', 'improvedScript', 'alternativeVersions'],
                        },
                    },
                },
            }
        )

        const text = response.candidates?.[0]?.content?.parts?.[0]?.text
        if (!text) {
            throw createError({ statusCode: 502, statusMessage: 'Empty response from Gemini API.' })
        }

        return JSON.parse(text)
    }

    return { checkHookHealth }
}
