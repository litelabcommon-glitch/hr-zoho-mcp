import { authManager, ZohoRegion, DEFAULT_ZOHO_SCOPES } from "../config/auth-manager.js";
import { ToolDefinition } from "./types.js";

export const authTools: ToolDefinition[] = [
  {
    name: "zoho_auth_status",
    description:
      "Check Zoho connection status, view the active logged-in Zoho User Profile (Name, Email, Role, Profile permissions), connected CRM/Books organizations, and instructions for user-scoped setup.",
    inputSchema: {
      type: "object",
      properties: {
        verifyLiveConnection: {
          type: "boolean",
          description: "If true, refreshes/validates the live Zoho access token and checks the current user profile.",
        },
      },
    },
    handler: async (args) => {
      const cfg = authManager.loadConfig();
      if (!cfg) {
        return {
          configured: false,
          configFilePath: authManager.getConfigFilePath(),
          recommendedForHrUser: [
            "Option A (Recommended for HR User / Nasrin — Server-based OAuth Login):",
            "1. Admin opens https://api-console.zoho.in/ -> Click '+ ADD CLIENT' -> Choose 'Server-based Applications'.",
            "2. Set Client Name: 'Litelab HR Autopilot', Homepage URL: 'http://localhost:3456', Authorized Redirect URI: 'http://localhost:3456/callback'.",
            "3. Copy the Client ID and Client Secret.",
            "4. Call `zoho_auth_browser_login` with `clientId` and `clientSecret` (and optionally `expectedUserEmail: 'nasrin@...'`).",
            "5. A browser tab opens automatically — Nasrin signs in with HER Zoho account and clicks Accept. All Zoho permissions & logs are strictly locked to Nasrin's Zoho Profile!",
          ],
        };
      }

      let liveTokenStatus = "not_checked";
      if (args?.verifyLiveConnection) {
        try {
          const token = await authManager.getAccessToken(true);
          const user = await authManager.fetchCurrentUserProfile(token, cfg.region);
          if (user) {
            cfg.authenticatedUser = user;
            authManager.saveConfig(cfg);
          }
          liveTokenStatus = "connected_and_valid";
        } catch (err: any) {
          liveTokenStatus = `error: ${err.message}`;
        }
      }

      return {
        configured: true,
        region: cfg.region,
        authenticatedUser: cfg.authenticatedUser || "(Will be fetched on next live call)",
        expectedUserEmail: cfg.expectedUserEmail,
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
    name: "zoho_auth_browser_login",
    description:
      "Launch a 1-click browser OAuth login (`http://localhost:3456/callback`) so a specific team member (such as HR user Nasrin) can sign in with HER own Zoho email and password. Ensures all Zoho CRM & Books actions strictly obey her Zoho User Profile & Role permissions and stamp her name on all logs.",
    inputSchema: {
      type: "object",
      properties: {
        clientId: {
          type: "string",
          description: "Zoho 'Server-based Application' Client ID (created by Admin in Zoho API Console with Redirect URI http://localhost:3456/callback).",
        },
        clientSecret: {
          type: "string",
          description: "Zoho Client Secret.",
        },
        region: {
          type: "string",
          enum: ["in", "com", "eu", "com.au", "jp", "ca", "sa", "uk"],
          description: "Zoho Data Center region (default: 'in').",
        },
        expectedUserEmail: {
          type: "string",
          description:
            "Optional email address of the HR user (e.g. Nasrin's email). If provided, verifies that the logged-in Zoho account matches this email.",
        },
        scopes: {
          type: "string",
          description: `Optional custom scopes (defaults to: ${DEFAULT_ZOHO_SCOPES}). Note: only include scopes for Zoho products that the HR user has access to.`,
        },
        companyName: {
          type: "string",
          description: "Optional Company Name (e.g. 'Litelab') for generated DOCX/PDF letterhead.",
        },
      },
      required: ["clientId", "clientSecret"],
    },
    handler: async (args) => {
      const result = await authManager.startBrowserOAuthFlow({
        clientId: args.clientId,
        clientSecret: args.clientSecret,
        region: args.region as ZohoRegion | undefined,
        expectedUserEmail: args.expectedUserEmail,
        scopes: args.scopes,
        branding: {
          companyName: args.companyName,
        },
      });

      return {
        success: true,
        message: result.message,
        authenticatedUser: result.config.authenticatedUser,
        region: result.config.region,
        crmConnected: result.crmConnected,
        crmOrgName: result.config.crmOrgName,
        booksConnected: result.booksConnected,
        booksOrgId: result.config.booksOrgId,
        booksOrgName: result.config.booksOrgName,
        branding: result.config.branding,
      };
    },
  },
  {
    name: "zoho_auth_configure",
    description:
      "Link Zoho CRM & Zoho Books using a Client ID, Client Secret, and either a 1-time Grant Token (code) OR an existing Refresh Token. Automatically verifies the logged-in user's Zoho Profile/Role and discovers the Zoho Books Organization ID.",
    inputSchema: {
      type: "object",
      properties: {
        clientId: {
          type: "string",
          description: "Zoho Client ID (starts with 1000....)",
        },
        clientSecret: {
          type: "string",
          description: "Zoho Client Secret",
        },
        grantToken: {
          type: "string",
          description: "1-time Grant Token (authorization code).",
        },
        refreshToken: {
          type: "string",
          description: "Existing Zoho OAuth Refresh Token (optional if grantToken is provided).",
        },
        redirectUri: {
          type: "string",
          description: "Optional Redirect URI if the code was generated from a Server-based Client (e.g. http://localhost:3456/callback).",
        },
        region: {
          type: "string",
          enum: ["in", "com", "eu", "com.au", "jp", "ca", "sa", "uk"],
          description: "Zoho Data Center region (default: 'in').",
        },
        expectedUserEmail: {
          type: "string",
          description:
            "Optional email of the HR user (e.g. Nasrin's email) to enforce profile matching.",
        },
        booksOrgId: {
          type: "string",
          description: "Optional Zoho Books Organization ID (auto-discovered if omitted).",
        },
        companyName: {
          type: "string",
          description: "Optional Company Name for generated client DOCX/PDF letterhead.",
        },
        hrSignatoryName: {
          type: "string",
          description: "Optional HR Signatory Name (e.g. 'Nasrin') for client agreements & offer letters.",
        },
        hrSignatoryTitle: {
          type: "string",
          description: "Optional HR Signatory Title (e.g. 'HR Executive').",
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
        redirectUri: args.redirectUri,
        region: args.region as ZohoRegion | undefined,
        expectedUserEmail: args.expectedUserEmail,
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
        authenticatedUser: result.config.authenticatedUser,
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
