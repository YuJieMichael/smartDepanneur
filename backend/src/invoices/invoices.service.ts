import {
  BadRequestException,
  ConflictException,
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';
import { InventoryMovementType, Prisma } from '@prisma/client';
import { AuditTrailService } from '../audit-trail/audit-trail.service';
import { PrismaService } from '../prisma/prisma.service';
import { extractInvoice, SUPPORTED_INVOICE_TYPES } from './invoice-extraction';
import { matchInvoiceLines } from './invoice-matching';

interface Operator {
  id: number;
  email: string;
}

export interface ReceiveInvoiceInput {
  invoiceNumber?: string | null;
  supplierName?: string | null;
  lines?: { productId: number; quantity: number; unitCost?: number | null }[];
}

const REFERENCE_TYPE = 'supplier_invoice';
const MAX_LINES = 200;

@Injectable()
export class InvoicesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditTrailService: AuditTrailService,
  ) {}

  /** Reads an invoice into a draft. Stock is not changed. */
  async scan(file: { buffer: Buffer; mimetype: string; originalname: string } | undefined) {
    if (!file) throw new BadRequestException('Attach an invoice photo or PDF as "file"');
    if (!SUPPORTED_INVOICE_TYPES.has(file.mimetype)) {
      throw new BadRequestException('Invoice must be a JPEG, PNG, WebP, GIF or PDF file');
    }
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      throw new ServiceUnavailableException(
        'Invoice scanning needs OPENAI_API_KEY. Stock can still be received manually.',
      );
    }

    let invoice;
    try {
      invoice = await extractInvoice(file, {
        apiKey,
        model: process.env.OPENAI_VISION_MODEL || process.env.OPENAI_MODEL || 'gpt-4o-mini',
        signal: AbortSignal.timeout(45_000),
      });
    } catch (error) {
      throw new ServiceUnavailableException(
        error instanceof Error ? error.message : 'Invoice could not be read',
      );
    }

    const products = await this.prisma.product.findMany({
      where: { isActive: true },
      select: { id: true, name: true, sku: true, barcode: true, unit: true, costPrice: true },
    });
    const lines = matchInvoiceLines(
      invoice.lines,
      products.map((product) => ({ ...product, costPrice: Number(product.costPrice) })),
    );
    const alreadyReceived = invoice.invoiceNumber
      ? await this.findReceipt(invoice.invoiceNumber, invoice.supplierName)
      : null;

    return {
      supplierName: invoice.supplierName,
      invoiceNumber: invoice.invoiceNumber,
      invoiceDate: invoice.invoiceDate,
      alreadyReceived: alreadyReceived !== null,
      matchedCount: lines.filter((line) => line.match).length,
      costChangeCount: lines.filter((line) => line.costChange).length,
      lines,
    };
  }

  /** Receives reviewed invoice lines into stock in one transaction. */
  async receive(input: ReceiveInvoiceInput, operator: Operator) {
    const invoiceNumber = input.invoiceNumber?.trim();
    if (!invoiceNumber) throw new BadRequestException('invoiceNumber is required');
    const supplierName = input.supplierName?.trim() || null;
    const lines = input.lines ?? [];
    if (lines.length === 0 || lines.length > MAX_LINES) {
      throw new BadRequestException(`Provide between 1 and ${MAX_LINES} lines`);
    }
    for (const line of lines) {
      if (!Number.isInteger(line.productId) || line.productId <= 0) {
        throw new BadRequestException('Every line needs a productId');
      }
      if (!Number.isInteger(line.quantity) || line.quantity <= 0) {
        throw new BadRequestException('Every line quantity must be a positive integer');
      }
      if (line.unitCost !== undefined && line.unitCost !== null && !(line.unitCost >= 0)) {
        throw new BadRequestException('unitCost must be zero or more');
      }
    }
    if (await this.findReceipt(invoiceNumber, supplierName)) {
      throw new ConflictException(`Invoice ${invoiceNumber} was already received`);
    }

    const reason = this.receiptReason(invoiceNumber, supplierName);
    const movements = await this.prisma.$transaction(async (tx) => {
      const created = [];
      for (const line of lines) {
        const updated = await tx.product.updateMany({
          where: { id: line.productId, isActive: true },
          data: { currentStock: { increment: line.quantity } },
        });
        if (updated.count !== 1) {
          throw new BadRequestException(`Active product ${line.productId} not found`);
        }
        created.push(
          await tx.inventoryMovement.create({
            data: {
              type: InventoryMovementType.purchase,
              quantity: line.quantity,
              unitCost:
                line.unitCost === undefined || line.unitCost === null
                  ? null
                  : new Prisma.Decimal(line.unitCost).toDecimalPlaces(2),
              reason,
              referenceType: REFERENCE_TYPE,
              product: { connect: { id: line.productId } },
              user: { connect: { id: operator.id } },
            },
            select: {
              id: true,
              quantity: true,
              product: { select: { id: true, name: true, currentStock: true } },
            },
          }),
        );
      }
      return created;
    });

    await Promise.all(
      movements.map((movement) =>
        this.auditTrailService.create({
          table: 'inventory_movements',
          recordId: movement.id,
          field: 'invoice_receipt',
          oldValue: null,
          newValue: `${reason}: ${movement.product.name} +${movement.quantity}`,
          userId: operator.id,
          userEmail: operator.email,
        }),
      ),
    );

    return {
      invoiceNumber,
      supplierName,
      receivedLines: movements.length,
      receivedUnits: movements.reduce((sum, movement) => sum + movement.quantity, 0),
      products: movements.map((movement) => movement.product),
    };
  }

  private receiptReason(invoiceNumber: string, supplierName: string | null) {
    return supplierName
      ? `Invoice ${invoiceNumber} (${supplierName})`
      : `Invoice ${invoiceNumber}`;
  }

  private findReceipt(invoiceNumber: string, supplierName: string | null) {
    return this.prisma.inventoryMovement.findFirst({
      where: {
        referenceType: REFERENCE_TYPE,
        reason: this.receiptReason(invoiceNumber.trim(), supplierName?.trim() || null),
      },
      select: { id: true },
    });
  }
}
