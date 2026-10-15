import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { InsightsService } from '../insights/insights.service';
import { createStoreMcpServer } from './store-mcp.server';

async function connect(insights: InsightsService) {
  const server = createStoreMcpServer(insights);
  const client = new Client({ name: 'test-client', version: '1.0.0' });
  const [clientTransport, serverTransport] =
    InMemoryTransport.createLinkedPair();
  await Promise.all([
    server.connect(serverTransport),
    client.connect(clientTransport),
  ]);
  return { client, server };
}

describe('Store MCP server', () => {
  it('exposes read-only tools and proposal tools, none destructive', async () => {
    const { client, server } = await connect({} as InsightsService);

    try {
      const { tools } = await client.listTools();

      expect(tools.map((tool) => tool.name).sort()).toEqual([
        'get_expiry_risks',
        'get_min_stock_review',
        'get_reorder_suggestions',
        'get_slow_movers',
        'get_store_summary',
        'get_top_sellers',
        'propose_min_stock_change',
        'propose_purchase_orders',
      ]);
      for (const tool of tools) {
        expect(tool.annotations).toMatchObject({
          readOnlyHint: !tool.name.startsWith('propose_'),
          destructiveHint: false,
        });
      }
      const minStock = tools.find(
        (tool) => tool.name === 'propose_min_stock_change',
      );
      expect(minStock?.inputSchema.required).toEqual([
        'productId',
        'newMinStock',
        'reason',
      ]);
    } finally {
      await client.close();
      await server.close();
    }
  });

  it('returns the same data the in-app agent receives', async () => {
    const summary = {
      activeProductCount: 10,
      todaySaleCount: 2,
      lowStockProductCount: 3,
    };
    const executeAgentTool = jest.fn().mockResolvedValue(summary);
    const { client, server } = await connect({
      executeAgentTool,
    } as unknown as InsightsService);

    try {
      const result = await client.callTool({
        name: 'get_store_summary',
        arguments: {},
      });

      expect(executeAgentTool).toHaveBeenCalledWith(
        'get_store_summary',
        {},
        { source: 'mcp', requestedBy: null },
      );
      expect(result.isError).toBeFalsy();
      const [content] = result.content as { type: string; text: string }[];
      expect(JSON.parse(content.text)).toEqual(summary);
    } finally {
      await client.close();
      await server.close();
    }
  });

  it('reports a tool failure to the client instead of crashing', async () => {
    const { client, server } = await connect({
      executeAgentTool: jest
        .fn()
        .mockRejectedValue(new Error('database unavailable')),
    } as unknown as InsightsService);

    try {
      const result = await client.callTool({
        name: 'get_reorder_suggestions',
        arguments: {},
      });

      expect(result.isError).toBe(true);
      const [content] = result.content as { type: string; text: string }[];
      expect(content.text).toBe(
        'get_reorder_suggestions failed: database unavailable',
      );
    } finally {
      await client.close();
      await server.close();
    }
  });

  it('records a proposal from an MCP client with its arguments', async () => {
    const executeAgentTool = jest.fn().mockResolvedValue({
      proposed: true,
      proposal: { id: 7, status: 'pending' },
    });
    const { client, server } = await connect({
      executeAgentTool,
    } as unknown as InsightsService);

    try {
      const result = await client.callTool({
        name: 'propose_min_stock_change',
        arguments: { productId: 3, newMinStock: 12, reason: 'Weekend demand' },
      });

      expect(result.isError).toBeFalsy();
      expect(executeAgentTool).toHaveBeenCalledWith(
        'propose_min_stock_change',
        { productId: 3, newMinStock: 12, reason: 'Weekend demand' },
        { source: 'mcp', requestedBy: null },
      );
    } finally {
      await client.close();
      await server.close();
    }
  });
});
