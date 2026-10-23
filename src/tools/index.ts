import { authTools } from "./auth-tools.js";
import { crmTools } from "./crm-tools.js";
import { hrLogTools } from "./hr-log-tools.js";
import { booksTools } from "./books-tools.js";
import { customModuleTools } from "./custom-module-tools.js";
import { documentTools } from "./document-tools.js";
import { ToolDefinition } from "./types.js";

export const allTools: ToolDefinition[] = [
  ...authTools,
  ...crmTools,
  ...hrLogTools,
  ...booksTools,
  ...customModuleTools,
  ...documentTools,
];
