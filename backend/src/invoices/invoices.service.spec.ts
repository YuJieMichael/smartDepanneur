import { ConflictException, ServiceUnavailableException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { AuditTrailService } from '../audit-trail/audit-trail.service';
import { PrismaService } from '../prisma/prisma.service';
import { extractInvoice } from './invoice-extraction';
import { InvoicesService } from './invoices.service';

const owner = { id: 1, email: 'owner@smartdepanneur.local' };
const photo = {
  buffer: Buffer.from('fake-jpeg'),
  mimetype: 'image/jpeg',
  originalname: 'invoice.jpg',
};

function mockOpenAi(body: unknown, ok = true) {
  const fetchMock = jest.fn().mockResolvedValue({
    ok,
    status: ok ? 200 : 500,
    json: () => Promise.resolve(body),
  } as Response);
  global.fetch = fetchMock;
  return fetchMock;
}

describe('invoice extraction', () => {
  const previousFetch = global.fetch;
  afterEach(() => {
    global.fetch = previousFetch;
  });

  it('sends the photo with a strict schema and returns the lines', async () => {
    const fetchMock = mockOpenAi({
      output_text: JSON.stringify({
        supplierName: 'Metro Beverage Supply',
        invoiceNumber: 'MB-20417',
        invoiceDate: '2026-10-14',
        lines: [{ description: 'COKE 355ML 24PK', sku: null, quantity: 48, unitCost: 0.95 }],
      }),
    });

    const invoice = await extractInvoice(photo, { apiKey: 'test-key' });

    expect(invoice.lines).toEqual([
      { description: 'COKE 355ML 24PK', sku: null, quantity: 48, unitCost: 0.95 },
    ]);
    const body = JSON.parse(fetchMock.mock.calls[0][1].body as string);
    expect(body.text.format).toMatchObject({ type: 'json_schema', strict: true });
    expect(body.input[0].content[1]).toMatchObject({
      type: 'input_image',
      image_url: `data:image/jpeg;base64,${photo.buffer.toString('base64')}`,
    });
  });

  it('sends a PDF as a file', async () => {
    const fetchMock = mockOpenAi({
      output_text: JSON.stringify({ supplierName: null, invoiceNumber: null, invoiceDate: null, lines: [] }),
    });

    await extractInvoice({ ...photo, mimetype: 'application/pdf', originalname: 'inv.pdf' }, { apiKey: 'k' });

    const body = JSON.parse(fetchMock.mock.calls[0][1].body as string);
    expect(body.input[0].content[1]).toMatchObject({ type: 'input_file', filename: 'inv.pdf' });
  });

  it('rejects output that does not fit the schema', async () => {
    mockOpenAi({ output_text: JSON.stringify({ lines: [{ description: 'x', quantity: -2 }] }) });

    await expect(extractInvoice(photo, { apiKey: 'k' })).rejects.toThrow(
      'unexpected shape',
    );
  });

  it('surfaces a model refusal', async () => {
    mockOpenAi({ output: [{ content: [{ type: 'refusal', refusal: 'Not an invoice' }] }] });

    await expect(extractInvoice(photo, { apiKey: 'k' })).rejects.toThrow('Not an invoice');
  });
});

describe('InvoicesService', () => {
  function setup(existingReceipt: { id: number } | null = null) {
    const tx = {
      product: { updateMany: jest.fn().mockResolvedValue({ count: 1 }) },
      inventoryMovement: {
        create: jest.fn().mockImplementation(({ data }: { data: { quantity: number; product: { connect: { id: number } } } }) =>
          Promise.resolve({
            id: data.product.connect.id + 100,
            quantity: data.quantity,
            product: { id: data.product.connect.id, name: `Product ${data.product.connect.id}`, currentStock: 50 },
          }),
        ),
      },
    };
    const prisma = {
      inventoryMovement: { findFirst: jest.fn().mockResolvedValue(existingReceipt) },
      product: { findMany: jest.fn().mockResolvedValue([]) },
      $transaction: jest.fn((run: (client: typeof tx) => Promise<unknown>) => run(tx)),
    };
    const audit = { create: jest.fn().mockResolvedValue({}) };
    const service = new InvoicesService(
      prisma as unknown as PrismaService,
      audit as unknown as AuditTrailService,
    );
    return { service, prisma, tx, audit };
  }

  it('receives every reviewed line in one transaction', async () => {
    const { service, tx, audit } = setup();

    const result = await service.receive(
      {
        invoiceNumber: 'MB-20417',
        supplierName: 'Metro Beverage Supply',
        lines: [
          { productId: 1, quantity: 48, unitCost: 0.95 },
          { productId: 2, quantity: 24, unitCost: 1.85 },
        ],
      },
      owner,
    );

    expect(result).toMatchObject({ receivedLines: 2, receivedUnits: 72 });
    expect(tx.product.updateMany).toHaveBeenCalledWith({
      where: { id: 1, isActive: true },
      data: { currentStock: { increment: 48 } },
    });
    expect(tx.inventoryMovement.create.mock.calls[0][0].data).toMatchObject({
      type: 'purchase',
      reason: 'Invoice MB-20417 (Metro Beverage Supply)',
      referenceType: 'supplier_invoice',
      unitCost: new Prisma.Decimal('0.95'),
    });
    expect(audit.create).toHaveBeenCalledTimes(2);
  });

  it('refuses to receive the same invoice twice', async () => {
    const { service, prisma } = setup({ id: 5 });

    await expect(
      service.receive(
        { invoiceNumber: 'MB-20417', supplierName: 'Metro Beverage Supply', lines: [{ productId: 1, quantity: 1 }] },
        owner,
      ),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('rejects fractional quantities before touching stock', async () => {
    const { service, prisma } = setup();

    await expect(
      service.receive({ invoiceNumber: 'A1', lines: [{ productId: 1, quantity: 1.5 }] }, owner),
    ).rejects.toThrow('positive integer');
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('explains that scanning needs an API key', async () => {
    const previousKey = process.env.OPENAI_API_KEY;
    delete process.env.OPENAI_API_KEY;
    const { service } = setup();

    try {
      await expect(service.scan(photo)).rejects.toBeInstanceOf(ServiceUnavailableException);
    } finally {
      if (previousKey !== undefined) process.env.OPENAI_API_KEY = previousKey;
    }
  });
});
