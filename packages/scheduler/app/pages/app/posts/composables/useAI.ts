/**
 *
 * Composable Description: AI-powered content generation and manipulation for social media posts
 *
 * @author Ismael Garcia <leamsigc@leamsigc.com>
 * @version 0.0.1
 *
 * @todo [ ] Test the composable
 * @todo [ ] Integration test.
 * @todo [✔] Update the typescript.
 */

import type { SocialMediaPlatformConfigurations } from "./usePlatformConfiguration";


export const useAI = () => {
    const isLoading = ref(false);
    const error = ref<string | null>(null);
    const toast = useToast();

    const callAI = async (action: string, content: string, options: { tone?: string; platforms?: string[] } = {}) => {
        isLoading.value = true;
        error.value = null;

        try {
            const response = await $fetch<{ result: any }>('/api/v1/ai/generate', {
                method: 'POST',
                body: {
                    action,
                    content,
                    tone: options.tone,
                    platforms: options.platforms,
                },
            });

            return response.result;
        } catch (err: any) {
            error.value = err.message || 'Failed to generate AI content';
            toast.add({
                title: 'AI Error',
                description: error.value,
                icon: 'i-heroicons-exclamation-triangle',
                color: 'error',
            });
            throw err;
        } finally {
            isLoading.value = false;
        }
    };

    const smartSplit = async (content: string, platforms: (keyof SocialMediaPlatformConfigurations)[]) => {
        const result = await callAI('smartSplit', content, { platforms });
        return Array.isArray(result) ? result : [result];
    };

    const rewriteContent = async (content: string, tone: 'fun' | 'professional' | 'concise') => {
        const result = await callAI('rewrite', content, { tone });
        return typeof result === 'string' ? result : result[0] || content;
    };

    const fixGrammar = async (content: string) => {
        const result = await callAI('fixGrammar', content);
        return typeof result === 'string' ? result : result[0] || content;
    };

    const generateHashtags = async (content: string) => {
        const result = await callAI('generateHashtags', content);
        return Array.isArray(result) ? result : [result];
    };

    const customPrompt = async (prompt: string) => {
        const result = await callAI('custom', prompt);
        return typeof result === 'string' ? result : result[0] || '';
    };

    return {
        isLoading,
        error,
        smartSplit,
        rewriteContent,
        fixGrammar,
        generateHashtags,
        customPrompt,
    };
};
