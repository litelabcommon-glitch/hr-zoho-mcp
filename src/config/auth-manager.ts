import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import dotenv from "dotenv";

dotenv.config();

export type ZohoRegion = "com" | "in" | "eu" | "com.au" | "jp" | "ca" | "sa" | "uk";

export interface ZohoEndpoints {
  region: ZohoRegion;
  accountsUrl: string;
  crmApiUrl: string;
  booksApiUrl: string;
  peopleApiUrl: string;
  recruitApiUrl: string;
}

export interface CompanyBranding {
  companyName?: string;
  companyAddress?: string;
  companyEmail?: string;
  companyPhone?: string;
  companyWebsite?: string;
  defaultCurrency?: string;
  hrSignatoryName?: string;
  hrSignatoryTitle?: string;
}

export interface ZohoStoredConfig {
  region: ZohoRegion;
  clientId: string;
  clientSecret: string;
  refreshToken: string;
  accessToken?: string;
  accessTokenExpiresAt?: number;
  booksOrgId?: string;
  booksOrgName?: string;
  crmOrgName?: string;
  branding?: CompanyBranding;
  updatedAt: string;
}

const REGION_MAP: Record<ZohoRegion, ZohoEndpoints> = {
  com: {
    region: "com",
    accountsUrl: "https://accounts.zoho.com",
    crmApiUrl: "https://www.zohoapis.com/crm/v6",
    booksApiUrl: "https://www.zohoapis.com/books/v3",
    peopleApiUrl: "https://people.zoho.com/people/api",
    recruitApiUrl: "https://recruit.zoho.com/recruit/v2",
  },
  in: {
    region: "in",
    accountsUrl: "https://accounts.zoho.in",
    crmApiUrl: "https://www.zohoapis.in/crm/v6",
    booksApiUrl: "https://www.zohoapis.in/books/v3",
    peopleApiUrl: "https://people.zoho.in/people/api",
    recruitApiUrl: "https://recruit.zoho.in/recruit/v2",
  },
  eu: {
    region: "eu",
    accountsUrl: "https://accounts.zoho.eu",
    crmApiUrl: "https://www.zohoapis.eu/crm/v6",
    booksApiUrl: "https://www.zohoapis.eu/books/v3",
    peopleApiUrl: "https://people.zoho.eu/people/api",
    recruitApiUrl: "https://recruit.zoho.eu/recruit/v2",
  },
  "com.au": {
    region: "com.au",
    accountsUrl: "https://accounts.zoho.com.au",
    crmApiUrl: "https://www.zohoapis.com.au/crm/v6",
    booksApiUrl: "https://www.zohoapis.com.au/books/v3",
    peopleApiUrl: "https://people.zoho.com.au/people/api",
    recruitApiUrl: "https://recruit.zoho.com.au/recruit/v2",
  },
  jp: {
    region: "jp",
    accountsUrl: "https://accounts.zoho.jp",
    crmApiUrl: "https://www.zohoapis.jp/crm/v6",
    booksApiUrl: "https://www.zohoapis.jp/books/v3",
    peopleApiUrl: "https://people.zoho.jp/people/api",
    recruitApiUrl: "https://recruit.zoho.jp/recruit/v2",
  },
  ca: {
    region: "ca",
    accountsUrl: "https://accounts.zohocloud.ca",
    crmApiUrl: "https://www.zohoapis.ca/crm/v6",
    booksApiUrl: "https://www.zohoapis.ca/books/v3",
    peopleApiUrl: "https://people.zohocloud.ca/people/api",
    recruitApiUrl: "https://recruit.zohocloud.ca/recruit/v2",
  },
  sa: {
    region: "sa",
    accountsUrl: "https://accounts.zoho.sa",
    crmApiUrl: "https://www.zohoapis.sa/crm/v6",
    booksApiUrl: "https://www.zohoapis.sa/books/v3",
    peopleApiUrl: "https://people.zoho.sa/people/api",
    recruitApiUrl: "https://recruit.zoho.sa/recruit/v2",
  },
  uk: {
    region: "uk",
    accountsUrl: "https://accounts.zoho.uk",
    crmApiUrl: "https://www.zohoapis.uk/crm/v6",
    booksApiUrl: "https://www.zohoapis.uk/books/v3",
    peopleApiUrl: "https://people.zoho.uk/people/api",
    recruitApiUrl: "https://recruit.zoho.uk/recruit/v2",
  },
};

export class ZohoAuthManager {
  private configDir: string;
  private configPath: string;
  private cachedConfig: ZohoStoredConfig | null = null;

  constructor() {
    this.configDir = path.join(os.homedir(), ".zoho-hr-mcp");
    this.configPath = path.join(this.configDir, "credentials.json");
  }

  public getConfigFilePath(): string {
    return this.configPath;
  }

  public getEndpoints(region?: ZohoRegion): ZohoEndpoints {
    const cfg = this.loadConfig();
    const resolvedRegion = region || cfg?.region || (process.env.ZOHO_REGION as ZohoRegion) || "in";
    return REGION_MAP[resolvedRegion] || REGION_MAP.in;
  }

  public loadConfig(): ZohoStoredConfig | null {
    if (this.cachedConfig) {
      return this.cachedConfig;
    }

    // 1. Check ~/.zoho-hr-mcp/credentials.json
    if (fs.existsSync(this.configPath)) {
      try {
        const raw = fs.readFileSync(this.configPath, "utf-8");
        this.cachedConfig = JSON.parse(raw) as ZohoStoredConfig;
        return this.cachedConfig;
      } catch {
        // Ignore malformed JSON and fallback to env
      }
    }

    // 2. Check workspace .zoho-credentials.json
    const localPath = path.join(process.cwd(), ".zoho-credentials.json");
    if (fs.existsSync(localPath)) {
      try {
        const raw = fs.readFileSync(localPath, "utf-8");
        this.cachedConfig = JSON.parse(raw) as ZohoStoredConfig;
        return this.cachedConfig;
      } catch {
        // Ignore malformed JSON
      }
    }

    // 3. Check environment variables
    if (
      process.env.ZOHO_CLIENT_ID &&
      process.env.ZOHO_CLIENT_SECRET &&
      process.env.ZOHO_REFRESH_TOKEN
    ) {
      this.cachedConfig = {
        region: ((process.env.ZOHO_REGION as ZohoRegion) || "in"),
        clientId: process.env.ZOHO_CLIENT_ID,
        clientSecret: process.env.ZOHO_CLIENT_SECRET,
        refreshToken: process.env.ZOHO_REFRESH_TOKEN,
        booksOrgId: process.env.ZOHO_BOOKS_ORG_ID || undefined,
        branding: {
          companyName: process.env.COMPANY_NAME,
          companyAddress: process.env.COMPANY_ADDRESS,
          companyEmail: process.env.COMPANY_EMAIL,
          companyPhone: process.env.COMPANY_PHONE,
        },
        updatedAt: new Date().toISOString(),
      };
      return this.cachedConfig;
    }

    return null;
  }

  public saveConfig(config: ZohoStoredConfig): void {
    if (!fs.existsSync(this.configDir)) {
      fs.mkdirSync(this.configDir, { recursive: true });
    }
    config.updatedAt = new Date().toISOString();
    fs.writeFileSync(this.configPath, JSON.stringify(config, null, 2), {
      encoding: "utf-8",
      mode: 0o600,
    });
    this.cachedConfig = config;
  }

  public updateBranding(branding: CompanyBranding): ZohoStoredConfig {
    const current = this.loadConfig();
    if (!current) {
      throw new Error(
        "Zoho credentials are not configured yet. Please run `zoho_auth_configure` first."
      );
    }
    current.branding = {
      ...(current.branding || {}),
      ...branding,
    };
    this.saveConfig(current);
    return current;
  }

  /**
   * Configures Zoho authentication using either a 1-time Self-Client Grant Token (code)
   * OR an existing Refresh Token. Also auto-discovers Zoho Books Organization ID if not provided.
   */
  public async configureCredentials(params: {
    clientId: string;
    clientSecret: string;
    grantToken?: string;
    refreshToken?: string;
    region?: ZohoRegion;
    booksOrgId?: string;
    branding?: CompanyBranding;
  }): Promise<{
    config: ZohoStoredConfig;
    crmConnected: boolean;
    booksConnected: boolean;
    discoveredBooksOrgs: Array<{ organization_id: string; name: string; is_default_org?: boolean }>;
    message: string;
  }> {
    const existing = this.loadConfig();
    let region: ZohoRegion = params.region || existing?.region || "in";
    const clientId = params.clientId.trim();
    const clientSecret = params.clientSecret.trim();

    let refreshToken = params.refreshToken?.trim() || existing?.refreshToken || "";
    let accessToken = "";
    let expiresIn = 3600;

    if (params.grantToken) {
      const code = params.grantToken.trim();
      // Try the requested region first; if invalid_client / wrong region, automatically probe common regions
      const candidateRegions: ZohoRegion[] = [
        region,
        ...(["in", "com", "eu", "com.au", "uk", "ca", "sa", "jp"] as ZohoRegion[]).filter(
          (r) => r !== region
        ),
      ];

      let lastError = "";
      let exchanged = false;

      for (const tryRegion of candidateRegions) {
        const endpoints = REGION_MAP[tryRegion];
        const tokenUrl = `${endpoints.accountsUrl}/oauth/v2/token`;
        const body = new URLSearchParams({
          grant_type: "authorization_code",
          client_id: clientId,
          client_secret: clientSecret,
          code,
        });

        try {
          const resp = await fetch(tokenUrl, {
            method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            body: body.toString(),
          });
          const data = (await resp.json()) as Record<string, any>;

          if (data.access_token) {
            region = tryRegion;
            accessToken = data.access_token;
            if (data.refresh_token) {
              refreshToken = data.refresh_token;
            }
            expiresIn = Number(data.expires_in || 3600);
            exchanged = true;
            break;
          } else {
            lastError = data.error || JSON.stringify(data);
            // If error is invalid_code, the region matched the client, but the grant code expired/was already used
            if (data.error === "invalid_code") {
              region = tryRegion;
              break;
            }
          }
        } catch (err: any) {
          lastError = err?.message || String(err);
        }
      }

      if (!exchanged) {
        throw new Error(
          `Failed to exchange Zoho Grant Token for Refresh Token (Error: ${lastError}). ` +
            `Make sure you generated a fresh Self-Client Grant Token in https://api-console.zoho.${region}/ ` +
            `and pasted it within its expiry window (3–10 minutes).`
        );
      }
    }

    if (!refreshToken) {
      throw new Error(
        "Either a 1-time `grantToken` (from Zoho API Console -> Self Client) or an existing `refreshToken` is required."
      );
    }

    const newConfig: ZohoStoredConfig = {
      region,
      clientId,
      clientSecret,
      refreshToken,
      accessToken: accessToken || undefined,
      accessTokenExpiresAt: accessToken ? Date.now() + (expiresIn - 180) * 1000 : undefined,
      booksOrgId: params.booksOrgId || existing?.booksOrgId,
      branding: {
        ...(existing?.branding || {}),
        ...(params.branding || {}),
      },
      updatedAt: new Date().toISOString(),
    };

    this.saveConfig(newConfig);

    // Ensure we have a valid accessToken via refresh if we didn't just exchange a grant code
    if (!accessToken) {
      accessToken = await this.getAccessToken(true);
    }

    // Probe Zoho CRM organization info
    let crmConnected = false;
    const endpoints = this.getEndpoints(region);
    try {
      const crmResp = await fetch(`${endpoints.crmApiUrl}/org`, {
        headers: { Authorization: `Zoho-oauthtoken ${accessToken}` },
      });
      if (crmResp.ok) {
        const crmData = (await crmResp.json()) as Record<string, any>;
        const org = crmData.org?.[0];
        if (org) {
          crmConnected = true;
          newConfig.crmOrgName = org.company_name || org.alias;
          if (!newConfig.branding?.companyName && org.company_name) {
            newConfig.branding = {
              ...(newConfig.branding || {}),
              companyName: org.company_name,
              companyEmail: newConfig.branding?.companyEmail || org.primary_email,
              companyPhone: newConfig.branding?.companyPhone || org.phone,
              companyWebsite: newConfig.branding?.companyWebsite || org.website,
              defaultCurrency: newConfig.branding?.defaultCurrency || org.currency_symbol || org.iso_code,
            };
          }
        }
      }
    } catch {
      // Non-fatal if CRM org endpoint scope wasn't included
    }

    // Probe Zoho Books organizations to auto-discover booksOrgId
    let booksConnected = false;
    let discoveredBooksOrgs: Array<{
      organization_id: string;
      name: string;
      is_default_org?: boolean;
    }> = [];
    try {
      const booksResp = await fetch(`${endpoints.booksApiUrl}/organizations`, {
        headers: { Authorization: `Zoho-oauthtoken ${accessToken}` },
      });
      if (booksResp.ok) {
        const booksData = (await booksResp.json()) as Record<string, any>;
        if (Array.isArray(booksData.organizations) && booksData.organizations.length > 0) {
          booksConnected = true;
          discoveredBooksOrgs = booksData.organizations.map((o: any) => ({
            organization_id: String(o.organization_id),
            name: String(o.name),
            is_default_org: Boolean(o.is_default_org),
          }));
          if (!newConfig.booksOrgId) {
            const defaultOrg =
              discoveredBooksOrgs.find((o) => o.is_default_org) || discoveredBooksOrgs[0];
            newConfig.booksOrgId = defaultOrg.organization_id;
            newConfig.booksOrgName = defaultOrg.name;
          } else {
            const matched = discoveredBooksOrgs.find(
              (o) => o.organization_id === newConfig.booksOrgId
            );
            if (matched) {
              newConfig.booksOrgName = matched.name;
            }
          }
        }
      }
    } catch {
      // Non-fatal if Zoho Books is not yet enabled on account
    }

    this.saveConfig(newConfig);

    return {
      config: newConfig,
      crmConnected,
      booksConnected,
      discoveredBooksOrgs,
      message: `Successfully linked Zoho (${region.toUpperCase()}) credentials and stored at ${this.configPath}`,
    };
  }

  /**
   * Returns a valid Zoho OAuth2 access token, refreshing automatically when needed.
   */
  public async getAccessToken(forceRefresh = false): Promise<string> {
    const config = this.loadConfig();
    if (!config || !config.clientId || !config.clientSecret || !config.refreshToken) {
      throw new Error(
        "Zoho credentials are not configured yet! " +
          "Call the `zoho_auth_configure` tool with your Zoho Self-Client `clientId`, `clientSecret`, and `grantToken` (or `refreshToken`)."
      );
    }

    if (
      !forceRefresh &&
      config.accessToken &&
      config.accessTokenExpiresAt &&
      Date.now() < config.accessTokenExpiresAt
    ) {
      return config.accessToken;
    }

    const endpoints = this.getEndpoints(config.region);
    const tokenUrl = `${endpoints.accountsUrl}/oauth/v2/token`;
    const body = new URLSearchParams({
      grant_type: "refresh_token",
      client_id: config.clientId,
      client_secret: config.clientSecret,
      refresh_token: config.refreshToken,
    });

    const resp = await fetch(tokenUrl, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: body.toString(),
    });

    const data = (await resp.json()) as Record<string, any>;
    if (!resp.ok || !data.access_token) {
      throw new Error(
        `Failed to refresh Zoho access token (${endpoints.region}): ${data.error || resp.statusText}`
      );
    }

    const expiresIn = Number(data.expires_in || 3600);
    config.accessToken = data.access_token;
    config.accessTokenExpiresAt = Date.now() + (expiresIn - 180) * 1000;
    this.saveConfig(config);

    return data.access_token;
  }

  public getBooksOrgId(): string {
    const config = this.loadConfig();
    if (!config?.booksOrgId) {
      throw new Error(
        "Zoho Books Organization ID (`booksOrgId`) is not set. Run `zoho_auth_status` or `zoho_auth_configure` with `booksOrgId`."
      );
    }
    return config.booksOrgId;
  }
}

export const authManager = new ZohoAuthManager();
