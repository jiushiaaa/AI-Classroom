import { getCurrentModelConfig } from '@/lib/utils/model-config';

/** Headers for client-side calls to /api/generate/* routes (model + credentials). */
export function getGenerateRequestHeaders(): Record<string, string> {
  const modelConfig = getCurrentModelConfig();
  return {
    'Content-Type': 'application/json',
    'x-model': modelConfig.modelString,
    'x-api-key': modelConfig.apiKey,
    'x-base-url': modelConfig.baseUrl,
    'x-provider-type': modelConfig.providerType || '',
  };
}
