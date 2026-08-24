import type { BusinessProfile, CreateBusinessProfileData } from '#layers/BaseDB/db/schema';
import type { InformationSchemaBusinessResponse, InformationExtractionEvent } from '#layers/BaseScheduler/server/api/v1/ai/information/index.post';
import type { ServiceResponse } from '#layers/BaseDB/server/services/types';
import { ref } from 'vue';



const businesses = ref<PaginatedResponse<BusinessProfile>>({
  data: [] as BusinessProfile[],
  pagination: {
    page: 1,
    limit: 10,
    total: 0,
    totalPages: 0
  }
});

export const useBusinessManager = () => {

  const activeBusinessId = useState<string | undefined>('business:id');
  const getAllBusinesses = async () => {
    try {
      const data = await $fetch<PaginatedResponse<BusinessProfile>>('/api/v1/business');
      businesses.value = data;
      if (data.pagination?.total === 0) {
        activeBusinessId.value = undefined
      }
    } catch (error) {
      console.error('Error fetching businesses:', error);
    }
  };

  const addBusiness = async (business: Record<string, unknown>): Promise<BusinessProfile | undefined> => {
    try {
      const response = await $fetch<ServiceResponse<BusinessProfile>>('/api/v1/business', {
        method: 'POST',
        body: { ...business },
      });
      
      if (response.error) {
        throw new Error(response.error);
      }
      
      await getAllBusinesses();
      return response.data;
    } catch (error) {
      console.error('Error adding business:', error);
      throw error;
    }
  };

  const extractBusinessInfo = async (payload: { url: string; explanation: string; competitors?: string[] }) => {
    try {
      const result = await $fetch<InformationSchemaBusinessResponse>('/api/v1/ai/information', {
        method: 'POST',
        body: payload
      });
      return result;
    } catch (error) {
      console.error('Error extracting business info:', error);
      throw error;
    }
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

    const processLine = (line: string) => {
      if (!line.trim()) return;
      let event: InformationExtractionEvent;
      try {
        event = JSON.parse(line) as InformationExtractionEvent;
      } catch {
        return;
      }
      onEvent(event);
      if (event.type === 'complete') completed = event.data;
      if (event.type === 'error') failure = new Error(event.message || 'Extraction failed');
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
    try {
      const updatedBusiness = await $fetch<BusinessProfile>(`/api/v1/business/${id}`, {
        method: 'PUT',
        body: updatedFields,
      });
      await getAllBusinesses();
    } catch (error) {
      console.error(`Error updating business with ID ${id}:`, error);
      throw error;
    }
  };

  const deleteBusiness = async (id: string) => {
    if (id === activeBusinessId.value) {
      activeBusinessId.value = undefined
    }
    try {
      await $fetch(`/api/v1/business/${id}`, {
        method: 'DELETE',
      });
      await getAllBusinesses();
    } catch (error) {
      console.error(`Error deleting business with ID ${id}:`, error);
      throw error;
    }
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
    setActiveBusiness
  };
};
