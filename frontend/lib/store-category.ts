export type StoreLocale = 'en' | 'fr' | 'zh';

const CATEGORY_LABELS: Record<string, Record<StoreLocale, string>> = {
  Drinks: { en: 'Drinks', fr: 'Boissons', zh: '饮料' },
  Beverages: { en: 'Beverages', fr: 'Boissons', zh: '饮料' },
  Bakery: { en: 'Bakery', fr: 'Boulangerie', zh: '烘焙食品' },
  Snacks: { en: 'Snacks', fr: 'Collations', zh: '零食' },
  Dairy: { en: 'Dairy', fr: 'Produits laitiers', zh: '乳制品' },
  Household: { en: 'Household', fr: 'Maison', zh: '家居用品' },
  OTC: { en: 'OTC', fr: 'Médicaments', zh: '非处方药' },
  Lottery: { en: 'Lottery', fr: 'Loterie', zh: '彩票' },
  Uncategorized: { en: 'Uncategorized', fr: 'Non classé', zh: '未分类' },
};

export function localizeStoreCategory(
  categoryName: string,
  locale: StoreLocale,
) {
  return CATEGORY_LABELS[categoryName]?.[locale] ?? categoryName;
}
