import type { ProviderId } from '@/lib/types/provider';

export type HomeYuntiQuickModel = {
  readonly label: string;
  /** i18n key for the subtitle under the model name (e.g. `home.quickModels.yuntiPlusTagline`). */
  readonly taglineKey: string;
  readonly providerId: ProviderId;
  readonly modelId: string;
};

function parseProviderModelSpec(
  raw: string | undefined,
  fallback: { providerId: ProviderId; modelId: string },
): { providerId: ProviderId; modelId: string } {
  if (!raw?.trim()) return fallback;
  const idx = raw.indexOf(':');
  if (idx <= 0 || idx === raw.length - 1) return fallback;
  return {
    providerId: raw.slice(0, idx).trim() as ProviderId,
    modelId: raw.slice(idx + 1).trim(),
  };
}

const DEFAULT_PLUS = { providerId: 'google' as ProviderId, modelId: 'gemini-2.5-flash' };
const DEFAULT_PRO = { providerId: 'google' as ProviderId, modelId: 'gemini-2.5-pro' };

/** Home toolbar: two fixed display names mapped to real provider/model (overridable via env). */
export const HOME_YUNTI_QUICK_MODELS: readonly HomeYuntiQuickModel[] = [
  {
    label: 'Yunti-plus',
    taglineKey: 'home.quickModels.yuntiPlusTagline',
    ...parseProviderModelSpec(process.env.NEXT_PUBLIC_HOME_YUNTI_PLUS, DEFAULT_PLUS),
  },
  {
    label: 'Yunti-pro',
    taglineKey: 'home.quickModels.yuntiProTagline',
    ...parseProviderModelSpec(process.env.NEXT_PUBLIC_HOME_YUNTI_PRO, DEFAULT_PRO),
  },
];

export function getHomeYuntiLabelForSelection(
  providerId: ProviderId,
  modelId: string,
): string | null {
  for (const row of HOME_YUNTI_QUICK_MODELS) {
    if (row.providerId === providerId && row.modelId === modelId) return row.label;
  }
  return null;
}
