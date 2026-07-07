import { apiGetDictionaryByKey } from '@/api/dictionary';

export async function loadStateOptions(
  countryName: string,
): Promise<{ label: string; value: string }[]> {
  if (!countryName) return [];
  const dict = await apiGetDictionaryByKey(`state_${countryName}`).catch(() => null);
  return dict ? dict.value.map((v) => ({ label: v, value: v })) : [];
}
