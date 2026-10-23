import { authManager, ZohoRegion } from "../config/auth-manager.js";
import { ToolDefinition } from "./types.js";

export const authTools: ToolDefinition[] = [
  {
    name: "zoho_auth_status",
    description:
      "Check whether Zoho CRM & Zoho Books credentials are configured, view active region, connected organizations, company branding, and get step-by-step instructions if not yet linked.",
    inputSchema: {
      type: "object",
      properties: {
        verifyLiveConnection: {
          type: "boolean",
          description: "If true, tests refreshing/validating the live Zoho access token.",
        },
      },
    },
    handler: async (args) => {
      const cfg = authManager.loadConfig();
      if (!cfg) {
        return {
          configured: false,
          configFilePath: authManager.getConfigFilePath(),
          howToLinkZoho: [
            "1. Open Zoho API Console (https://api-console.zoho.in/ or https://api-console.zoho.com/ depending on your region).",
            "2. Click 'Add Client' -> Choose 'Self Client' -> Click 'Create'.",
            "3. Copy the 'Client ID' and 'Client Secret' from the 'Client Secret' tab.",
            "4. Go to the 'Generate Code' tab and paste this Scope string:",
            "   ZohoCRM.modules.ALL,ZohoCRM.settings.ALL,ZohoCRM.org.READ,ZohoCRM.coql.READ,ZohoBooks.fullaccess.all,ZohoRecruit.modules.ALL,ZOHOPEOPLE.forms.ALL",
            "5. Set Time Duration to 10 minutes, enter any description (e.g. 'HR MCP'), and click 'Create' to get your Grant Token (code).",
            "6. Paste the Client ID, Client Secret, and Grant Token directly into chat so I can call `zoho_auth_configure` for you!",
          ],
        };
      }

      let liveTokenStatus = "not_checked";
      if (args?.verifyLiveConnection) {
        try {
          await authManager.getAccessToken(true);
          liveTokenStatus = "connected_and_valid";
        } catch (err: any) {
          liveTokenStatus = `error: ${err.message}`;
        }
      }

      return {
        configured: true,
        region: cfg.region,
        crmOrgName: cfg.crmOrgName || "(Auto-detected on first CRM call)",
        booksOrgId: cfg.booksOrgId || "(Auto-detected on first Books call)",
        booksOrgName: cfg.booksOrgName,
        branding: cfg.branding || {},
        configFilePath: authManager.getConfigFilePath(),
        updatedAt: cfg.updatedAt,
        liveTokenStatus,
      };
    },
  },
  {
    name: "zoho_auth_configure",
    description:
      "Link Zoho CRM, Zoho Books, and Zoho People/Recruit by providing a Zoho Self-Client Client ID, Client Secret, and either a 1-time Grant Token (code) OR an existing Refresh Token. Automatically exchanges the grant token, discovers Zoho Books Organization ID, and saves credentials locally.",
    inputSchema: {
      type: "object",
      properties: {
        clientId: {
          type: "string",
          description: "Zoho Self-Client ID (starts with 1000....)",
        },
        clientSecret: {
          type: "string",
          description: "Zoho Self-Client Secret",
        },
        grantToken: {
          type: "string",
          description:
            "1-time Grant Token (authorization code) generated from Zoho API Console -> Self Client -> Generate Code tab.",
        },
        refreshToken: {
          type: "string",
          description:
            "Existing Zoho OAuth Refresh Token (optional if grantToken is provided).",
        },
        region: {
          type: "string",
          enum: ["in", "com", "eu", "com.au", "jp", "ca", "sa", "uk"],
          description: "Zoho Data Center region (default: 'in' or auto-detected).",
        },
        booksOrgId: {
          type: "string",
          description:
            "Optional Zoho Books Organization ID (auto-discovered if omitted).",
        },
        companyName: {
          type: "string",
          description: "Optional Company Name for generated client DOCX/PDF letterhead.",
        },
        hrSignatoryName: {
          type: "string",
          description: "Optional HR Signatory Name for client agreements & offer letters.",
        },
        hrSignatoryTitle: {
          type: "string",
          description: "Optional HR Signatory Title (e.g. 'Head of HR & Operations').",
        },
      },
      required: ["clientId", "clientSecret"],
    },
    handler: async (args) => {
      const result = await authManager.configureCredentials({
        clientId: args.clientId,
        clientSecret: args.clientSecret,
        grantToken: args.grantToken,
        refreshToken: args.refreshToken,
        region: args.region as ZohoRegion | undefined,
        booksOrgId: args.booksOrgId,
        branding: {
          companyName: args.companyName,
          hrSignatoryName: args.hrSignatoryName,
          hrSignatoryTitle: args.hrSignatoryTitle,
        },
      });

      return {
        success: true,
        message: result.message,
        region: result.config.region,
        crmConnected: result.crmConnected,
        crmOrgName: result.config.crmOrgName,
        booksConnected: result.booksConnected,
        booksOrgId: result.config.booksOrgId,
        booksOrgName: result.config.booksOrgName,
        discoveredBooksOrgs: result.discoveredBooksOrgs,
        branding: result.config.branding,
      };
    },
  },
  {
    name: "zoho_update_company_branding",
    description:
      "Configure company letterhead and HR signatory details used when dynamically generating DOCX/PDF agreements, proposals, and offer letters.",
    inputSchema: {
      type: "object",
      properties: {
        companyName: { type: "string" },
        companyAddress: { type: "string" },
        companyEmail: { type: "string" },
        companyPhone: { type: "string" },
        companyWebsite: { type: "string" },
        defaultCurrency: { type: "string", description: "e.g., INR, USD, EUR, AED" },
        hrSignatoryName: { type: "string" },
        hrSignatoryTitle: { type: "string" },
      },
    },
    handler: async (args) => {
      const updated = authManager.updateBranding(args);
      return {
        success: true,
        branding: updated.branding,
      };
    },
  },
];
