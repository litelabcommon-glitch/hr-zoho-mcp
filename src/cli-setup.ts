#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import readline from "node:readline";
import { fileURLToPath } from "node:url";
import { authManager, ZohoRegion } from "./config/auth-manager.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, "..");
const DIST_INDEX = path.join(REPO_ROOT, "dist", "index.js");

function copyDirRecursive(src: string, dest: string) {
  if (!fs.existsSync(dest)) {
    fs.mkdirSync(dest, { recursive: true });
  }
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      copyDirRecursive(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

function registerAntigravityAndClaude() {
  const workspaceMcpConfig = {
    mcpServers: {
      "zoho-hr-suite": {
        command: "node",
        args: ["dist/index.js"],
      },
    },
  };

  const absoluteMcpConfig = {
    mcpServers: {
      "zoho-hr-suite": {
        command: "node",
        args: [DIST_INDEX],
      },
    },
  };

  // 1. Ensure workspace .agents/plugins/zoho-hr-suite/mcp_config.json stays portable for Git
  const workspacePluginDir = path.join(REPO_ROOT, ".agents", "plugins", "zoho-hr-suite");
  if (fs.existsSync(workspacePluginDir)) {
    fs.writeFileSync(
      path.join(workspacePluginDir, "mcp_config.json"),
      JSON.stringify(workspaceMcpConfig, null, 2),
      "utf-8"
    );
    console.log(`[✓] Verified workspace plugin MCP config: ${path.join(workspacePluginDir, "mcp_config.json")}`);

    // 2. Also install plugin globally to ~/.gemini/config/plugins/zoho-hr-suite with absolute path so it works in ANY workspace on HR's laptop!
    const globalPluginDir = path.join(os.homedir(), ".gemini", "config", "plugins", "zoho-hr-suite");
    copyDirRecursive(workspacePluginDir, globalPluginDir);
    fs.writeFileSync(
      path.join(globalPluginDir, "mcp_config.json"),
      JSON.stringify(absoluteMcpConfig, null, 2),
      "utf-8"
    );
    console.log(`[✓] Installed Antigravity global plugin: ${globalPluginDir}`);
  }

  // 3. Also merge into ~/.gemini/config/mcp_config.json for instant MCP availability
  const globalMcpConfigPath = path.join(os.homedir(), ".gemini", "config", "mcp_config.json");
  try {
    const globalConfigDir = path.dirname(globalMcpConfigPath);
    if (!fs.existsSync(globalConfigDir)) {
      fs.mkdirSync(globalConfigDir, { recursive: true });
    }
    let existingMcp: Record<string, any> = { mcpServers: {} };
    if (fs.existsSync(globalMcpConfigPath)) {
      existingMcp = JSON.parse(fs.readFileSync(globalMcpConfigPath, "utf-8"));
      if (!existingMcp.mcpServers) existingMcp.mcpServers = {};
    }
    existingMcp.mcpServers["zoho-hr-suite"] = {
      command: "node",
      args: [DIST_INDEX],
    };
    fs.writeFileSync(globalMcpConfigPath, JSON.stringify(existingMcp, null, 2), "utf-8");
    console.log(`[✓] Registered MCP server in Antigravity global config: ${globalMcpConfigPath}`);
  } catch (err: any) {
    console.warn(`[!] Could not update global mcp_config.json: ${err.message}`);
  }

  // 4. Optional: Register in Claude Desktop config if directory exists
  const claudeConfigPath =
    process.platform === "win32"
      ? path.join(process.env.APPDATA || path.join(os.homedir(), "AppData", "Roaming"), "Claude", "claude_desktop_config.json")
      : process.platform === "darwin"
      ? path.join(os.homedir(), "Library", "Application Support", "Claude", "claude_desktop_config.json")
      : path.join(os.homedir(), ".config", "Claude", "claude_desktop_config.json");

  if (fs.existsSync(path.dirname(claudeConfigPath))) {
    try {
      let claudeCfg: Record<string, any> = { mcpServers: {} };
      if (fs.existsSync(claudeConfigPath)) {
        claudeCfg = JSON.parse(fs.readFileSync(claudeConfigPath, "utf-8"));
        if (!claudeCfg.mcpServers) claudeCfg.mcpServers = {};
      }
      claudeCfg.mcpServers["zoho-hr-suite"] = {
        command: "node",
        args: [DIST_INDEX],
      };
      fs.writeFileSync(claudeConfigPath, JSON.stringify(claudeCfg, null, 2), "utf-8");
      console.log(`[✓] Registered MCP server in Claude Desktop: ${claudeConfigPath}`);
    } catch {
      // Ignore if Claude Desktop config isn't writable
    }
  }
}

async function runInteractivePrompt() {
  console.log("\n========================================================");
  console.log("   Zoho HR & Books Automation Suite — Setup Wizard");
  console.log("========================================================\n");

  registerAntigravityAndClaude();

  if (process.argv.includes("--non-interactive")) {
    console.log("\n[✓] Non-interactive plugin & MCP registration complete!");
    console.log("    HR can now link her Zoho keys directly inside Antigravity chat");
    console.log("    by saying: 'Set up my Zoho account' or pasting her Self-Client keys.\n");
    return;
  }

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  const ask = (q: string): Promise<string> =>
    new Promise((resolve) => rl.question(q, (ans) => resolve(ans.trim())));

  const wantAuthNow = await ask(
    "\nWould you like to link Zoho Self-Client credentials now in terminal? (y/N - or press Enter to link later inside Antigravity chat): "
  );

  if (wantAuthNow.toLowerCase().startsWith("y")) {
    console.log("\n--- Zoho API Console (Self-Client) ---");
    console.log("1. Go to https://api-console.zoho.in/ (or .com / .eu)");
    console.log("2. Create/Open 'Self Client'");
    console.log("3. Generate a Grant Code with scopes:");
    console.log("   ZohoCRM.modules.ALL,ZohoCRM.settings.ALL,ZohoCRM.org.READ,ZohoCRM.coql.READ,ZohoBooks.fullaccess.all,ZohoRecruit.modules.ALL,ZOHOPEOPLE.forms.ALL\n");

    const regionInput = (await ask("Zoho Region [in / com / eu / com.au] (default: in): ")) || "in";
    const clientId = await ask("Zoho Client ID: ");
    const clientSecret = await ask("Zoho Client Secret: ");
    const grantOrRefresh = await ask("Paste 1-time Grant Token (or existing Refresh Token): ");
    const companyName = await ask("Company Name (for client DOCX/PDF letterhead): ");
    const hrName = await ask("HR Signatory Name (optional): ");

    if (clientId && clientSecret && grantOrRefresh) {
      try {
        const isRefresh = grantOrRefresh.startsWith("1000.") && grantOrRefresh.length > 60 && !grantOrRefresh.includes("_");
        const res = await authManager.configureCredentials({
          clientId,
          clientSecret,
          grantToken: isRefresh ? undefined : grantOrRefresh,
          refreshToken: isRefresh ? grantOrRefresh : undefined,
          region: regionInput as ZohoRegion,
          branding: {
            companyName: companyName || undefined,
            hrSignatoryName: hrName || undefined,
          },
        });
        console.log(`\n[✓] ${res.message}`);
        console.log(`    CRM Connected: ${res.crmConnected} (${res.config.crmOrgName || "Ready"})`);
        console.log(`    Books Connected: ${res.booksConnected} (Org ID: ${res.config.booksOrgId || "None"})`);
      } catch (err: any) {
        console.error(`\n[!] Could not exchange token yet: ${err.message}`);
        console.log("    Don't worry! You can paste your keys directly into Antigravity chat anytime.");
      }
    }
  } else {
    console.log("\n[✓] Skipped terminal key entry. You or HR can paste Zoho keys directly in Antigravity chat!");
  }

  rl.close();
}

runInteractivePrompt().catch((err) => {
  console.error("Setup error:", err);
  process.exit(1);
});
