import { z } from 'zod';

// Reads a supplier invoice photo or PDF with an OpenAI vision model and
// returns its lines as structured data. Nothing here touches stock: the
// extracted lines are a draft the owner reviews before receiving.

export const SUPPORTED_INVOICE_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'application/pdf',
]);

const extractedInvoiceSchema = z.object({
  supplierName: z.string().nullable(),
  invoiceNumber: z.string().nullable(),
  invoiceDate: z.string().nullable(),
  lines: z
    .array(
      z.object({
        description: z.string().min(1),
        sku: z.string().nullable(),
        quantity: z.number().positive(),
        unitCost: z.number().nonnegative().nullable(),
      }),
    )
    .max(200),
});

export type ExtractedInvoice = z.infer<typeof extractedInvoiceSchema>;

// Strict structured-output schema: every property required, nullable where
// the invoice may not show a value.
const RESPONSE_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['supplierName', 'invoiceNumber', 'invoiceDate', 'lines'],
  properties: {
    supplierName: { type: ['string', 'null'] },
    invoiceNumber: { type: ['string', 'null'] },
    invoiceDate: {
      type: ['string', 'null'],
      description: 'Invoice date as YYYY-MM-DD',
    },
    lines: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['description', 'sku', 'quantity', 'unitCost'],
        properties: {
          description: { type: 'string' },
          sku: {
            type: ['string', 'null'],
            description: 'Supplier item code, UPC or SKU if printed on the line',
          },
          quantity: {
            type: 'number',
            description: 'Units received, multiplied out for packs (2 cases of 24 = 48)',
          },
          unitCost: {
            type: ['number', 'null'],
            description: 'Cost per single unit before tax, in dollars',
          },
        },
      },
    },
  },
} as const;

const INSTRUCTIONS =
  'You read supplier invoices for a Quebec convenience store. Extract only the product lines that were delivered. ' +
  'Skip deposits (consigne), taxes (TPS/TVQ/GST/QST), discounts, fees and totals. ' +
  'Convert packs to single units: quantity is the number of individual units and unitCost is the cost of one unit. ' +
  'Copy product descriptions as printed. Use null for anything the invoice does not show. Never invent lines.';

export async function extractInvoice(
  file: { buffer: Buffer; mimetype: string; originalname: string },
  options: { apiKey: string; model?: string; signal?: AbortSignal },
): Promise<ExtractedInvoice> {
  if (!SUPPORTED_INVOICE_TYPES.has(file.mimetype)) {
    throw new Error(`Unsupported invoice file type: ${file.mimetype}`);
  }
  const dataUrl = `data:${file.mimetype};base64,${file.buffer.toString('base64')}`;
  const attachment =
    file.mimetype === 'application/pdf'
      ? { type: 'input_file', filename: file.originalname || 'invoice.pdf', file_data: dataUrl }
      : { type: 'input_image', image_url: dataUrl, detail: 'high' };

  const response = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${options.apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: options.model ?? 'gpt-4o-mini',
      instructions: INSTRUCTIONS,
      input: [
        {
          role: 'user',
          content: [
            { type: 'input_text', text: 'Extract the delivered product lines from this supplier invoice.' },
            attachment,
          ],
        },
      ],
      text: {
        format: {
          type: 'json_schema',
          name: 'supplier_invoice',
          schema: RESPONSE_SCHEMA,
          strict: true,
        },
      },
    }),
    signal: options.signal,
  });

  if (!response.ok) {
    throw new Error(`OpenAI request failed with ${response.status}`);
  }
  const payload = (await response.json()) as {
    output_text?: unknown;
    output?: { content?: { type?: string; text?: unknown; refusal?: unknown }[] }[];
  };
  const content = payload.output?.flatMap((item) => item.content ?? []) ?? [];
  const refusal = content.find((item) => item.type === 'refusal');
  if (refusal) {
    throw new Error(`The model declined to read this invoice: ${String(refusal.refusal)}`);
  }
  const text =
    typeof payload.output_text === 'string'
      ? payload.output_text
      : content
          .map((item) => (typeof item.text === 'string' ? item.text : ''))
          .join('');

  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error('The invoice reader did not return valid JSON');
  }
  const result = extractedInvoiceSchema.safeParse(parsed);
  if (!result.success) {
    throw new Error('The invoice reader returned lines in an unexpected shape');
  }
  return result.data;
}
