import type { BusinessProfile } from '#layers/BaseDB/db/schema';
import type { InformationSchemaBusinessResponse, InformationExtractionEvent } from '../../server/types/information-schema';
import type { ServiceResponse } from '#layers/BaseDB/server/services/types';
import type { BusinessDeletePreview } from '#layers/BaseDB/server/services/business-profile.service.ts';
import { ref } from 'vue';

export type { BusinessDeletePreview };

export function extractDeleteErrorCode(error: unknown): string | undefined {
  const nested = error as { data?: { code?: string, data?: { code?: string } } }
  return nested?.data?.code ?? nested?.data?.data?.code
}

export function extractDeleteErrorMessage(error: unknown, fallback: string): string {
  const shaped = error as { data?: { message?: string }, statusMessage?: string }
  return shaped?.data?.message ?? shaped?.statusMessage ?? fallback
}



export const useBusinessManager = () => {

  // MUST stay useState (never module-scope ref): module state is a process
  // singleton on the server, so one request's businesses leak into the next
  // request's SSR HTML (wrong-user data + hydration mismatch -> 500 on /app).
  const businesses = useState<PaginatedResponse<BusinessProfile>>('business:list', () => ({
    data: [] as BusinessProfile[],
    pagination: {
      page: 1,
      limit: 10,
      total: 0,
      totalPages: 0
    }
  }));

  const activeBusinessId = useState<string | undefined>('business:id');
  const getAllBusinesses = async () => {
    try {
      const data = await $fetch<PaginatedResponse<BusinessProfile>>('/api/v1/business');
      businesses.value = data;
      if (data.pagination?.total === 0) {
        activeBusinessId.value = undefined
      }
    } catch {
      // Non-critical: callers render the last known list when refresh fails.
    }
  };

  const addBusiness = async (business: Record<string, unknown>): Promise<BusinessProfile | undefined> => {
    const response = await $fetch<ServiceResponse<BusinessProfile>>('/api/v1/business', {
      method: 'POST',
      body: { ...business },
    });

    if (response.error) {
      throw new Error(response.error);
    }

    await getAllBusinesses();
    return response.data;
  };

  const extractBusinessInfo = async (payload: { url: string; explanation: string; competitors?: string[] }) => {
    const result = await $fetch<InformationSchemaBusinessResponse>('/api/v1/ai/information', {
      method: 'POST',
      body: payload
    });
    return result;
  };

  /**
   * Streaming variant — reports backend progress events as they happen so the
   * UI can show the real active step instead of a fake timed loader.
   */
  const extractBusinessInfoWithProgress = async (
    payload: { url: string; explanation: string; competitors?: string[] },
    onEvent: (event: InformationExtractionEvent) => void
  ): Promise<InformationSchemaBusinessResponse> => {
    const response = await $fetch.raw<ReadableStream<Uint8Array>>('/api/v1/ai/information', {
      method: 'POST',
      body: payload,
      responseType: 'stream'
    });

    const body = response.body;

    if (!body) {
      throw new Error('No response stream from server');
    }

    const reader = body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let completed: InformationSchemaBusinessResponse | undefined;
    let failure: Error | undefined;

    const EVENT_TYPES = ['step', 'complete', 'error'];
    const isExtractionEvent = (value: unknown): value is InformationExtractionEvent => {
      return typeof value === 'object' && value !== null && EVENT_TYPES.includes((value as { type?: unknown }).type as string);
    };
    const processLine = (line: string) => {
      if (!line.trim()) return;
      let parsed: unknown;
      try {
        parsed = JSON.parse(line);
      } catch {
        return;
      }
      if (!isExtractionEvent(parsed)) return;
      onEvent(parsed);
      if (parsed.type === 'complete') completed = parsed.data;
      if (parsed.type === 'error') failure = new Error(parsed.message || 'Extraction failed');
    };

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() ?? '';
      for (const line of lines) processLine(line);
    }
    if (buffer) processLine(buffer);

    if (failure) throw failure;
    if (!completed) throw new Error('Extraction ended without a result');

    return completed;
  };

  const updateBusiness = async (id: string, updatedFields: Partial<BusinessProfile>) => {
    await $fetch<BusinessProfile>(`/api/v1/business/${id}`, {
      method: 'PUT',
      body: updatedFields,
    });
    await getAllBusinesses();
  };

  const getDeletePreview = async (id: string): Promise<BusinessDeletePreview> => {
    return await $fetch<BusinessDeletePreview>(`/api/v1/business/${id}/delete-preview`);
  };

  const deleteBusiness = async (id: string, reassignSocialAccountsTo?: string) => {
    const wasActive = id === activeBusinessId.value
    await $fetch(`/api/v1/business/${id}`, {
      method: 'DELETE',
      body: { reassignSocialAccountsTo }
    });
    if (wasActive) {
      activeBusinessId.value = undefined
    }
    await getAllBusinesses();
  };
  const setActiveBusiness = async (id: string) => {
    activeBusinessId.value = id
    await $fetch(`/api/v1/business/active`, {
      method: 'POST',
      body: { businessId: id, isActive: true },
    });
    getAllBusinesses();
  };

  return {
    businesses,
    activeBusinessId,
    getAllBusinesses,
    addBusiness,
    extractBusinessInfo,
    extractBusinessInfoWithProgress,
    updateBusiness,
    deleteBusiness,
    getDeletePreview,
    setActiveBusiness
  };
};
