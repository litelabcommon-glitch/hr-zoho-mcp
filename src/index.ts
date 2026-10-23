#!/usr/bin/env node
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";

import { allTools } from "./tools/index.js";
import { ToolDefinition } from "./tools/types.js";

const toolMap = new Map<string, ToolDefinition>();
for (const tool of allTools) {
  toolMap.set(tool.name, tool);
}

const server = new Server(
  {
    name: "zoho-hr-suite-mcp",
    version: "1.0.0",
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: allTools.map((t) => ({
      name: t.name,
      description: t.description,
      inputSchema: t.inputSchema,
    })),
  };
});

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;
  const tool = toolMap.get(name);

  if (!tool) {
    return {
      isError: true,
      content: [
        {
          type: "text",
          text: `Unknown tool: ${name}`,
        },
      ],
    };
  }

  try {
    const result = await tool.handler(args || {});
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(result, null, 2),
        },
      ],
    };
  } catch (err: any) {
    return {
      isError: true,
      content: [
        {
          type: "text",
          text: JSON.stringify(
            {
              error: true,
              tool: name,
              message: err?.message || String(err),
            },
            null,
            2
          ),
        },
      ],
    };
  }
});

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("Zoho HR & Books Suite MCP Server running on stdio");
}

main().catch((err) => {
  console.error("Fatal error starting Zoho HR Suite MCP Server:", err);
  process.exit(1);
});
