import { ref, readonly } from 'vue';
import type { Asset } from '#layers/BaseDB/db/schema';

/**
 * Asset Manager Composable for handling asset operations
 *
 * @author Ismael Garcia <leamsigc@leamsigc.com>
 * @version 0.0.1
 */
export const useAssetManager = () => {
  const isLoading = ref(false);
  const error = ref<string | null>(null);
  const businessId = useState<string>('business:id');

  /**
   * Fetches details for a list of asset IDs.
   */
  const getAssetsByIds = async (assetIds: string[]): Promise<Asset[]> => {
    isLoading.value = true;
    error.value = null;
    try {
      if (assetIds.length === 0) {
        return [];
      }
      const query = new URLSearchParams(assetIds.map(id => ['assetIds', id]));
      query.append('businessId', businessId.value);
      const response = await $fetch<{ data: Asset[] }>(`/api/v1/assets/search?${query.toString()}`);
      // Preserve requested order — DB `IN` does not guarantee order
      const byId = new Map(response.data.map(asset => [asset.id, asset]));
      return assetIds.map(id => byId.get(id)).filter((asset): asset is Asset => !!asset);
    } catch (err: any) {
      error.value = err.data?.message || err.message || 'Failed to fetch assets';
      throw err;
    } finally {
      isLoading.value = false;
    }
  };

  return {
    isLoading: readonly(isLoading),
    error: readonly(error),
    getAssetsByIds,
    clearError: () => error.value = null,
  };
};
