import { ConflictException } from '@nestjs/common';
import { AuditTrailService } from '../audit-trail/audit-trail.service';
import { PrismaService } from '../prisma/prisma.service';
import { PurchaseOrdersService } from '../purchase-orders/purchase-orders.service';
import { AgentActionsService } from './agent-actions.service';

const owner = { id: 1, email: 'owner@smartdepanneur.local' };
const minStockPayload = {
  productId: 3,
  productName: 'Milk 2% 1L',
  currentMinStock: 10,
  newMinStock: 14,
};

function setup(options: { claimed?: number; productUpdated?: number } = {}) {
  const agentAction = {
    updateMany: jest.fn().mockResolvedValue({ count: options.claimed ?? 1 }),
    findUnique: jest.fn().mockResolvedValue({
      id: 9,
      type: 'set_min_stock',
      payload: minStockPayload,
      status: 'approved',
    }),
    findUniqueOrThrow: jest.fn().mockResolvedValue({
      id: 9,
      type: 'set_min_stock',
      status: 'approved',
      source: 'openai-agent',
    }),
    update: jest.fn().mockResolvedValue({}),
  };
  const product = {
    updateMany: jest.fn().mockResolvedValue({ count: options.productUpdated ?? 1 }),
  };
  const audit = { create: jest.fn().mockResolvedValue({}) };
  const purchaseOrders = { generateFromReorderSuggestions: jest.fn() };
  const service = new AgentActionsService(
    { agentAction, product } as unknown as PrismaService,
    purchaseOrders as unknown as PurchaseOrdersService,
    audit as unknown as AuditTrailService,
  );
  return { service, agentAction, product, audit, purchaseOrders };
}

describe('AgentActionsService', () => {
  it('applies an approved minimum stock change and audits it', async () => {
    const { service, product, audit, agentAction } = setup();

    await service.approve(9, owner);

    expect(agentAction.updateMany).toHaveBeenCalledWith({
      where: { id: 9, status: 'pending' },
      data: expect.objectContaining({ status: 'approved', decidedById: 1 }),
    });
    // Only applies if the minimum is still what the agent saw.
    expect(product.updateMany).toHaveBeenCalledWith({
      where: { id: 3, minStock: 10 },
      data: { minStock: 14 },
    });
    expect(audit.create).toHaveBeenCalledWith(
      expect.objectContaining({ table: 'products', field: 'minStock', oldValue: '10', newValue: '14' }),
    );
    expect(audit.create).toHaveBeenCalledWith(
      expect.objectContaining({ table: 'agent_actions', field: '[approved]' }),
    );
  });

  it('marks the action failed when the minimum changed after the proposal', async () => {
    const { service, agentAction } = setup({ productUpdated: 0 });

    await service.approve(9, owner);

    expect(agentAction.update).toHaveBeenCalledWith({
      where: { id: 9 },
      data: {
        status: 'failed',
        error: 'Milk 2% 1L minimum stock changed after this proposal; review it again',
      },
    });
  });

  it('refuses to decide an action twice', async () => {
    const { service, product } = setup({ claimed: 0 });

    await expect(service.approve(9, owner)).rejects.toBeInstanceOf(ConflictException);
    expect(product.updateMany).not.toHaveBeenCalled();
  });

  it('rejects without changing store data', async () => {
    const { service, product, purchaseOrders, agentAction } = setup();

    await service.reject(9, owner, 'Supplier is closed this week');

    expect(agentAction.updateMany).toHaveBeenCalledWith({
      where: { id: 9, status: 'pending' },
      data: expect.objectContaining({
        status: 'rejected',
        error: 'Rejected: Supplier is closed this week',
      }),
    });
    expect(product.updateMany).not.toHaveBeenCalled();
    expect(purchaseOrders.generateFromReorderSuggestions).not.toHaveBeenCalled();
  });
});
