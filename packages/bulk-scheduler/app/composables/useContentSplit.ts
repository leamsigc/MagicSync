type Platform = 'facebook' | 'googlemybusiness' | 'linkedin' | 'twitter' | 'tiktok' | 'discord' | 'reddit' | 'youtube' | 'instagram' | 'threads' | 'dribbble' | 'bluesky' | 'devto' | 'wordpress' | 'email';
type Tone = 'professional' | 'casual' | 'witty' | 'inspirational' | 'direct' | 'angry' | 'clickbait' | 'humorous' | 'educational' | 'empathetic' | 'controversial' | 'exciting' | 'urgent';

type RepurposeResult = {
  content?: string[];
  comments?: string[];
};

type RepurposeResponse = {
  results: Record<Platform, RepurposeResult>;
};

export const useContentSplit = () => {
  const content = ref('');
  const url = ref('');
  const inputMode = ref<'content' | 'url'>('content');
  const selectedPlatforms = ref<Platform[]>([]);
  const selectedTone = ref<Tone>('professional');
  const isLoading = ref(false);
  const error = ref<string | null>(null);
  const results = ref<Record<string, RepurposeResult>>({});

  const toast = useToast();

  const platforms: { value: Platform; label: string; icon: string }[] = [
    { value: 'facebook', label: 'Facebook', icon: 'logos:facebook' },
    { value: 'googlemybusiness', label: 'Google Business', icon: 'logos:google' },
    { value: 'linkedin', label: 'LinkedIn', icon: 'logos:linkedin-icon' },
    { value: 'twitter', label: 'X (Twitter)', icon: 'logos:twitter' },
    { value: 'tiktok', label: 'TikTok', icon: 'logos:tiktok-icon' },
    { value: 'discord', label: 'Discord', icon: 'logos:discord-icon' },
    { value: 'reddit', label: 'Reddit', icon: 'logos:reddit-icon' },
    { value: 'youtube', label: 'YouTube', icon: 'logos:youtube-icon' },
    { value: 'instagram', label: 'Instagram', icon: 'logos:instagram-icon' },
    { value: 'threads', label: 'Threads', icon: 'fa6-brands:square-threads' },
    { value: 'dribbble', label: 'Dribbble', icon: 'logos:dribbble-icon' },
    { value: 'bluesky', label: 'Bluesky', icon: 'fa6-brands:bluesky' },
    { value: 'devto', label: 'Dev.to', icon: 'logos:dev-badge' },
    { value: 'wordpress', label: 'WordPress', icon: 'logos:wordpress-icon' },
    { value: 'email', label: 'Email Subject Lines', icon: 'lucide:mail' },
  ];

  const tones: { value: Tone; label: string; description: string }[] = [
    { value: 'professional', label: 'Professional', description: 'Professional and authoritative' },
    { value: 'casual', label: 'Casual', description: 'Casual and conversational' },
    { value: 'witty', label: 'Witty', description: 'Witty, playful, and clever' },
    { value: 'inspirational', label: 'Inspirational', description: 'Inspirational and motivating' },
    { value: 'direct', label: 'Direct', description: 'Direct and to-the-point' },
    { value: 'angry', label: 'Angry', description: 'Firm, frustrated, or passionate complaint' },
    { value: 'clickbait', label: 'Clickbait', description: 'Sensational and attention-grabbing' },
    { value: 'humorous', label: 'Humorous', description: 'Funny, entertaining, and light' },
    { value: 'educational', label: 'Educational', description: 'Informative and instructional' },
    { value: 'empathetic', label: 'Empathetic', description: 'Understanding and supportive' },
    { value: 'controversial', label: 'Controversial', description: 'Provocative and debate-sparking' },
    { value: 'exciting', label: 'Exciting', description: 'Enthusiastic and high-energy' },
    { value: 'urgent', label: 'Urgent', description: 'Time-sensitive and compelling' },
  ];

  const togglePlatform = (platform: Platform) => {
    const index = selectedPlatforms.value.indexOf(platform);
    if (index === -1) {
      selectedPlatforms.value.push(platform);
    } else {
      selectedPlatforms.value.splice(index, 1);
    }
  };

  const isPlatformSelected = (platform: Platform) => {
    return selectedPlatforms.value.includes(platform);
  };

  const generateContent = async () => {
    if (selectedPlatforms.value.length === 0) {
      toast.add({
        title: 'No platforms selected',
        description: 'Please select at least one platform',
        icon: 'i-heroicons-exclamation-triangle',
        color: 'warning',
      });
      return;
    }

    const inputContent = inputMode.value === 'content' ? content.value : '';
    const inputUrl = inputMode.value === 'url' ? url.value : '';

    if (!inputContent && !inputUrl) {
      toast.add({
        title: 'No content provided',
        description: 'Please enter content or a URL',
        icon: 'i-heroicons-exclamation-triangle',
        color: 'warning',
      });
      return;
    }

    isLoading.value = true;
    error.value = null;
    results.value = {};

    try {
      const response = await $fetch<RepurposeResponse>('/api/v1/ai/repurpose', {
        method: 'POST',
        body: {
          content: inputContent || undefined,
          url: inputUrl || undefined,
          platforms: selectedPlatforms.value,
          tone: selectedTone.value,
        },
      });

      results.value = response.results;

      toast.add({
        title: 'Content generated!',
        description: `Generated content for ${selectedPlatforms.value.length} platform(s)`,
        icon: 'i-heroicons-check-circle',
        color: 'success',
      });
    } catch (err: any) {
      error.value = err?.data?.message || err?.message || 'Failed to generate content';
      toast.add({
        title: 'Generation failed',
        description: error.value || 'Unknown error',
        icon: 'i-heroicons-exclamation-triangle',
        color: 'error',
      });
    } finally {
      isLoading.value = false;
    }
  };

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast.add({
        title: 'Copied!',
        icon: 'i-heroicons-clipboard-document-check',
        color: 'success',
      });
    } catch {
      toast.add({
        title: 'Failed to copy',
        icon: 'i-heroicons-exclamation-triangle',
        color: 'error',
      });
    }
  };

  const getContentAsString = (platform: string): string => {
    const result = results.value[platform];
    if (!result || !result.content) return '';
    return result.content.join('\n\n');
  };

  const reset = () => {
    content.value = '';
    url.value = '';
    results.value = {};
    error.value = null;
  };

  return {
    content,
    url,
    inputMode,
    selectedPlatforms,
    selectedTone,
    isLoading,
    error,
    results,
    platforms,
    tones,
    togglePlatform,
    isPlatformSelected,
    generateContent,
    copyToClipboard,
    getContentAsString,
    reset,
  };
};
