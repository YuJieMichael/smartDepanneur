import {
  CatalogueProduct,
  matchInvoiceLines,
  nameSimilarity,
  normalizeTokens,
} from './invoice-matching';

const CATALOGUE: CatalogueProduct[] = [
  { id: 1, name: 'Coca-Cola 355ml', sku: 'DRK-COKE-355', barcode: '067000004114', unit: 'can', costPrice: 0.95 },
  { id: 2, name: 'Red Bull 250ml', sku: 'DRK-RB-250', barcode: null, unit: 'can', costPrice: 1.85 },
  { id: 3, name: 'Milk 2% 1L', sku: null, barcode: null, unit: 'carton', costPrice: 1.6 },
  { id: 4, name: 'White Bread', sku: null, barcode: null, unit: 'loaf', costPrice: 1.75 },
  { id: 5, name: 'Ketchup Chips 235g', sku: null, barcode: null, unit: 'bag', costPrice: 2.1 },
];

describe('invoice matching', () => {
  it('normalizes accents, sizes, pack counts and French names', () => {
    expect(normalizeTokens('LAIT 2 % 1 L - Caisse 12X')).toEqual(['milk', '2%', '1l']);
    expect(normalizeTokens('Croustilles ketchup 235 g')).toEqual(['chips', 'ketchup', '235g']);
  });

  it('prefers an exact SKU or barcode over the name', () => {
    const [bySku, byBarcode] = matchInvoiceLines(
      [
        { description: 'Energy drink 250', sku: 'drk-rb-250', quantity: 24, unitCost: 1.85 },
        { description: 'Soft drink', sku: '0670 0000 4114', quantity: 24, unitCost: 0.95 },
      ],
      CATALOGUE,
    );

    expect(bySku.match).toMatchObject({ productId: 2, score: 1 });
    expect(bySku.matchedBy).toBe('sku');
    expect(byBarcode.match).toMatchObject({ productId: 1 });
    expect(byBarcode.matchedBy).toBe('barcode');
  });

  it('matches supplier wording to catalogue names', () => {
    const lines = matchInvoiceLines(
      [
        { description: 'COKE CLASSIQUE 355ML CAN 24PK', sku: null, quantity: 2, unitCost: 22.8 / 24 },
        { description: 'Lait 2% 1L', sku: null, quantity: 12, unitCost: 1.6 },
        { description: 'Pain blanc tranché', sku: null, quantity: 8, unitCost: 1.75 },
        { description: 'Croustilles Ketchup 235 g', sku: null, quantity: 10, unitCost: 2.1 },
      ],
      CATALOGUE,
    );

    expect(lines.map((line) => line.match?.productId)).toEqual([1, 3, 4, 5]);
    expect(lines.every((line) => line.matchedBy === 'name')).toBe(true);
  });

  it('leaves an unknown product unmatched but offers candidates', () => {
    const [line] = matchInvoiceLines(
      [{ description: 'Windshield washer fluid 4L', sku: null, quantity: 6, unitCost: 3.5 }],
      CATALOGUE,
    );

    expect(line.match).toBeNull();
    expect(line.matchedBy).toBeNull();
  });

  it('flags a supplier price increase over 5%', () => {
    const [line] = matchInvoiceLines(
      [{ description: 'Red Bull 250 ml', sku: null, quantity: 24, unitCost: 2.05 }],
      CATALOGUE,
    );

    expect(line.costChange).toEqual({ catalogueCost: 1.85, invoiceCost: 2.05, changePct: 10.8 });
  });

  it('scores identical names 1 and unrelated names 0', () => {
    expect(nameSimilarity('Red Bull 250ml', 'red bull 250 ML')).toBe(1);
    expect(nameSimilarity('Motor oil', 'White Bread')).toBe(0);
  });
});
