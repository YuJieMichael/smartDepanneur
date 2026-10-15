import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import {
  InsightsService,
  STORE_AGENT_TOOLS,
} from '../insights/insights.service';

export const STORE_MCP_SERVER_NAME = 'smartdepanneur-store';

/**
 * Exposes the Store Agent's read-only business tools over the Model Context
 * Protocol, so any MCP client (Claude Desktop, Claude Code, IDE agents) can
 * query live store data with the same tools the in-app agent uses.
 */
export function createStoreMcpServer(insights: InsightsService): McpServer {
  const server = new McpServer({
    name: STORE_MCP_SERVER_NAME,
    version: '1.0.0',
  });

  for (const tool of STORE_AGENT_TOOLS) {
    server.registerTool(
      tool.name,
      {
        title: tool.title,
        description: tool.description,
        annotations: {
          readOnlyHint: true,
          destructiveHint: false,
          idempotentHint: true,
          openWorldHint: false,
        },
      },
      async () => {
        try {
          const result = await insights.executeAgentTool(tool.name);
          return {
            content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
          };
        } catch (error) {
          return {
            isError: true,
            content: [
              {
                type: 'text',
                text: `${tool.name} failed: ${
                  error instanceof Error ? error.message : 'Unknown error'
                }`,
              },
            ],
          };
        }
      },
    );
  }

  return server;
}
