// Matches supplier invoice lines to catalogue products. Supplier invoices
// rarely use the store's own names ("COKE CLASSIQUE 355ML CAN 24PK" for
// "Coca-Cola 355ml"), so a SKU or barcode match wins, then a token-based name
// similarity that tolerates accents, case, punctuation and pack sizes.

export interface CatalogueProduct {
  id: number;
  name: string;
  sku: string | null;
  barcode: string | null;
  unit: string;
  costPrice: number;
}

export interface InvoiceLine {
  description: string;
  sku: string | null;
  quantity: number;
  unitCost: number | null;
}

export interface MatchCandidate {
  productId: number;
  productName: string;
  score: number;
}

export interface MatchedInvoiceLine extends InvoiceLine {
  match: MatchCandidate | null;
  matchedBy: 'sku' | 'barcode' | 'name' | null;
  candidates: MatchCandidate[];
  // Set when the invoiced unit cost differs from the catalogue cost by more
  // than COST_CHANGE_THRESHOLD, e.g. a supplier price increase.
  costChange: { catalogueCost: number; invoiceCost: number; changePct: number } | null;
}

export const NAME_MATCH_THRESHOLD = 0.5;
export const COST_CHANGE_THRESHOLD = 0.05;

const ALIASES: Record<string, string> = {
  coke: 'coca',
  cola: 'cola',
  lait: 'milk',
  pain: 'bread',
  blanc: 'white',
  oeufs: 'eggs',
  oeuf: 'eggs',
  egg: 'eggs',
  croustilles: 'chips',
  chip: 'chips',
  banane: 'bananas',
  bananes: 'bananas',
  banana: 'bananas',
  eau: 'water',
  yogourt: 'yogurt',
  yaourt: 'yogurt',
};

// Pack and container words carry no product identity.
const STOP_WORDS = new Set([
  'can', 'cans', 'canette', 'canettes', 'btl', 'bottle', 'bouteille', 'pk',
  'pack', 'paquet', 'case', 'caisse', 'cs', 'ea', 'each', 'unit', 'units',
  'x', 'de', 'du', 'la', 'le', 'les', 'the', 'of', 'and', 'et', 'classique',
  'classic', 'original', 'reg', 'regular',
]);

export function normalizeTokens(text: string): string[] {
  return text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    // Keep sizes together: "355 ml" -> "355ml", "2 %" -> "2%".
    .replace(/(\d+(?:[.,]\d+)?)\s*(ml|l|g|kg|lb|oz|%)/g, '$1$2')
    .replace(/[^a-z0-9%]+/g, ' ')
    .split(' ')
    .filter((token) => token.length > 0 && !STOP_WORDS.has(token))
    // Pack counts such as 24pk or 12x are not part of the product name.
    .filter((token) => !/^\d+(pk|x|ct)$/.test(token))
    .map((token) => ALIASES[token] ?? token);
}

/** Dice coefficient over token sets, with partial credit for prefixes. */
export function nameSimilarity(a: string, b: string): number {
  const left = [...new Set(normalizeTokens(a))];
  const right = [...new Set(normalizeTokens(b))];
  if (left.length === 0 || right.length === 0) return 0;

  let overlap = 0;
  const used = new Set<number>();
  for (const token of left) {
    let best = 0;
    let bestIndex = -1;
    right.forEach((candidate, index) => {
      if (used.has(index)) return;
      const score =
        token === candidate
          ? 1
          : token.length >= 3 &&
              candidate.length >= 3 &&
              (token.startsWith(candidate) || candidate.startsWith(token))
            ? 0.8
            : 0;
      if (score > best) {
        best = score;
        bestIndex = index;
      }
    });
    if (bestIndex >= 0) {
      used.add(bestIndex);
      overlap += best;
    }
  }
  return (2 * overlap) / (left.length + right.length);
}

function normalizeCode(code: string | null) {
  return code?.replace(/[\s-]/g, '').toLowerCase() || null;
}

export function matchInvoiceLines(
  lines: InvoiceLine[],
  products: CatalogueProduct[],
): MatchedInvoiceLine[] {
  return lines.map((line) => {
    const code = normalizeCode(line.sku);
    const bySku = code
      ? products.find((product) => normalizeCode(product.sku) === code)
      : undefined;
    const byBarcode = code && !bySku
      ? products.find((product) => normalizeCode(product.barcode) === code)
      : undefined;

    const candidates = products
      .map((product) => ({
        productId: product.id,
        productName: product.name,
        score: Math.round(nameSimilarity(line.description, product.name) * 100) / 100,
      }))
      .filter((candidate) => candidate.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 3);

    const exact = bySku ?? byBarcode;
    const match: MatchCandidate | null = exact
      ? { productId: exact.id, productName: exact.name, score: 1 }
      : candidates[0] && candidates[0].score >= NAME_MATCH_THRESHOLD
        ? candidates[0]
        : null;
    const matchedBy = bySku ? 'sku' : byBarcode ? 'barcode' : match ? 'name' : null;

    const product = match ? products.find((item) => item.id === match.productId) : undefined;
    const costChange =
      product && line.unitCost !== null && product.costPrice > 0
        ? (() => {
            const changePct = (line.unitCost - product.costPrice) / product.costPrice;
            return Math.abs(changePct) > COST_CHANGE_THRESHOLD
              ? {
                  catalogueCost: product.costPrice,
                  invoiceCost: line.unitCost,
                  changePct: Math.round(changePct * 1000) / 10,
                }
              : null;
          })()
        : null;

    return { ...line, match, matchedBy, candidates, costChange };
  });
}
