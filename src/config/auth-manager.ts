import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import http from "node:http";
import { exec } from "node:child_process";
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

export interface ZohoAuthenticatedUser {
  id: string;
  fullName: string;
  email: string;
  roleName?: string;
  profileName?: string;
  status?: string;
}

export interface ZohoStoredConfig {
  region: ZohoRegion;
  clientId: string;
  clientSecret: string;
  refreshToken: string;
  redirectUri?: string;
  accessToken?: string;
  accessTokenExpiresAt?: number;
  booksOrgId?: string;
  booksOrgName?: string;
  crmOrgName?: string;
  authenticatedUser?: ZohoAuthenticatedUser;
  expectedUserEmail?: string;
  branding?: CompanyBranding;
  updatedAt: string;
}

export const DEFAULT_ZOHO_SCOPES =
  "ZohoCRM.modules.ALL,ZohoCRM.settings.ALL,ZohoCRM.users.READ,ZohoCRM.org.READ,ZohoCRM.coql.READ,ZohoBooks.fullaccess.all";

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

function openUrlInBrowser(url: string): void {
  const platform = process.platform;
  if (platform === "win32") {
    exec(`start "" "${url}"`);
  } else if (platform === "darwin") {
    exec(`open "${url}"`);
  } else {
    exec(`xdg-open "${url}"`);
  }
}

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
    const resolvedRegion =
      region || cfg?.region || (process.env.ZOHO_REGION as ZohoRegion) || "in";
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
        region: (process.env.ZOHO_REGION as ZohoRegion) || "in",
        clientId: process.env.ZOHO_CLIENT_ID,
        clientSecret: process.env.ZOHO_CLIENT_SECRET,
        refreshToken: process.env.ZOHO_REFRESH_TOKEN,
        booksOrgId: process.env.ZOHO_BOOKS_ORG_ID || undefined,
        expectedUserEmail: process.env.ZOHO_EXPECTED_USER_EMAIL || undefined,
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
        "Zoho credentials are not configured yet. Please run `zoho_auth_configure` or `zoho_auth_browser_login` first."
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
   * Queries Zoho CRM /users?type=CurrentUser to identify the exact logged-in user (e.g., Nasrin),
   * her email, her Zoho Role, and her Zoho Profile permissions.
   */
  public async fetchCurrentUserProfile(
    accessToken: string,
    region: ZohoRegion
  ): Promise<ZohoAuthenticatedUser | undefined> {
    const endpoints = this.getEndpoints(region);
    try {
      const resp = await fetch(`${endpoints.crmApiUrl}/users?type=CurrentUser`, {
        headers: { Authorization: `Zoho-oauthtoken ${accessToken}` },
      });
      if (resp.ok) {
        const data = (await resp.json()) as Record<string, any>;
        const u = data.users?.[0];
        if (u) {
          return {
            id: String(u.id),
            fullName: String(u.full_name || u.first_name || "HR User"),
            email: String(u.email || ""),
            roleName: u.role?.name,
            profileName: u.profile?.name,
            status: u.status,
          };
        }
      }
    } catch {
      // Ignore if users.READ scope wasn't granted
    }
    return undefined;
  }

  /**
   * Discovers Zoho CRM Org, Zoho Books Org, and the Logged-In Zoho User Profile (Role & Profile).
   */
  private async enrichAndVerifyAccount(
    newConfig: ZohoStoredConfig,
    accessToken: string
  ): Promise<{
    crmConnected: boolean;
    booksConnected: boolean;
    discoveredBooksOrgs: Array<{
      organization_id: string;
      name: string;
      is_default_org?: boolean;
    }>;
  }> {
    const endpoints = this.getEndpoints(newConfig.region);

    // 1. Identify the logged-in Zoho User (e.g. Nasrin) and her Zoho Profile/Role
    const currentUser = await this.fetchCurrentUserProfile(accessToken, newConfig.region);
    if (currentUser) {
      newConfig.authenticatedUser = currentUser;
      if (!newConfig.branding?.hrSignatoryName) {
        newConfig.branding = {
          ...(newConfig.branding || {}),
          hrSignatoryName: currentUser.fullName,
          hrSignatoryTitle: currentUser.roleName || "HR & Client Operations",
        };
      }
    }

    // Check if an expectedUserEmail was specified and warn if a different user logged in
    if (
      newConfig.expectedUserEmail &&
      currentUser?.email &&
      currentUser.email.toLowerCase() !== newConfig.expectedUserEmail.toLowerCase()
    ) {
      throw new Error(
        `Profile Mismatch Protection: Expected Zoho user '${newConfig.expectedUserEmail}', ` +
          `but the token belongs to '${currentUser.fullName} (${currentUser.email})' [Profile: ${currentUser.profileName}]. ` +
          `Please log in using ${newConfig.expectedUserEmail}'s Zoho account so all permissions and logs match her profile.`
      );
    }

    // 2. Probe Zoho CRM organization info
    let crmConnected = Boolean(currentUser);
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
              defaultCurrency:
                newConfig.branding?.defaultCurrency || org.currency_symbol || org.iso_code,
            };
          }
        }
      }
    } catch {
      // Non-fatal
    }

    // 3. Probe Zoho Books organizations to auto-discover booksOrgId
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
      // Non-fatal if user's Zoho Books role doesn't list orgs or Books isn't used
    }

    this.saveConfig(newConfig);
    return { crmConnected, booksConnected, discoveredBooksOrgs };
  }

  /**
   * Launches a local browser OAuth 2.0 login flow (`http://localhost:3456/callback`).
   * Ideal when the Admin creates a "Server-based Application" in Zoho API Console once,
   * and Nasrin (HR) logs in with HER own Zoho email/password in the browser so the token
   * inherits ONLY Nasrin's Zoho Profile & Role permissions!
   */
  public async startBrowserOAuthFlow(params: {
    clientId: string;
    clientSecret: string;
    region?: ZohoRegion;
    port?: number;
    scopes?: string;
    expectedUserEmail?: string;
    booksOrgId?: string;
    branding?: CompanyBranding;
  }): Promise<{
    config: ZohoStoredConfig;
    crmConnected: boolean;
    booksConnected: boolean;
    discoveredBooksOrgs: Array<{
      organization_id: string;
      name: string;
      is_default_org?: boolean;
    }>;
    message: string;
  }> {
    const existing = this.loadConfig();
    const region: ZohoRegion = params.region || existing?.region || "in";
    const port = params.port || 3456;
    const redirectUri = `http://localhost:${port}/callback`;
    const scopes = params.scopes || DEFAULT_ZOHO_SCOPES;
    const endpoints = REGION_MAP[region];

    const authUrl = new URL(`${endpoints.accountsUrl}/oauth/v2/auth`);
    authUrl.searchParams.set("scope", scopes);
    authUrl.searchParams.set("client_id", params.clientId.trim());
    authUrl.searchParams.set("response_type", "code");
    authUrl.searchParams.set("access_type", "offline");
    authUrl.searchParams.set("prompt", "consent");
    authUrl.searchParams.set("redirect_uri", redirectUri);

    const codeResult = await new Promise<{ code: string; location?: string }>(
      (resolve, reject) => {
        const server = http.createServer((req, res) => {
          if (!req.url) return;
          const reqUrl = new URL(req.url, `http://localhost:${port}`);
          if (reqUrl.pathname === "/callback") {
            const code = reqUrl.searchParams.get("code");
            const error = reqUrl.searchParams.get("error");
            const location = reqUrl.searchParams.get("location") || undefined;

            if (error || !code) {
              res.writeHead(400, { "Content-Type": "text/html; charset=utf-8" });
              res.end(
                `<h2>Zoho Authorization Failed</h2><p>Error: ${error || "No code returned"}</p>`
              );
              clearTimeout(timeout);
              server.close();
              reject(new Error(`Zoho OAuth authorization failed: ${error || "No code"}`));
              return;
            }

            res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
            res.end(`
              <!DOCTYPE html>
              <html>
                <head><title>Zoho HR Autopilot Connected</title></head>
                <body style="font-family: system-ui, sans-serif; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; background: #0f172a; color: #f8fafc;">
                  <div style="background: #1e293b; padding: 36px; border-radius: 16px; text-align: center; max-width: 480px; box-shadow: 0 10px 25px rgba(0,0,0,0.4);">
                    <h1 style="color: #4ade80; margin-top: 0;">✓ Zoho Profile Linked!</h1>
                    <p style="font-size: 16px; line-height: 1.5; color: #cbd5e1;">
                      Your Zoho account and role permissions are now securely linked to <strong>Antigravity</strong>.
                    </p>
                    <p style="font-size: 14px; color: #94a3b8;">You can close this browser tab and return to Antigravity chat.</p>
                  </div>
                </body>
              </html>
            `);
            clearTimeout(timeout);
            server.close();
            resolve({ code, location });
          } else {
            res.writeHead(302, { Location: authUrl.toString() });
            res.end();
          }
        });

        const timeout = setTimeout(() => {
          server.close();
          reject(
            new Error(
              "Timed out waiting 3 minutes for browser login at " + authUrl.toString()
            )
          );
        }, 180_000);

        server.listen(port, () => {
          openUrlInBrowser(authUrl.toString());
        });

        server.on("error", (err) => {
          clearTimeout(timeout);
          reject(err);
        });
      }
    );

    // Exchange authorization code for access_token + refresh_token
    const tokenUrl = `${endpoints.accountsUrl}/oauth/v2/token`;
    const body = new URLSearchParams({
      grant_type: "authorization_code",
      client_id: params.clientId.trim(),
      client_secret: params.clientSecret.trim(),
      redirect_uri: redirectUri,
      code: codeResult.code,
    });

    const resp = await fetch(tokenUrl, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: body.toString(),
    });
    const tokenData = (await resp.json()) as Record<string, any>;

    if (!tokenData.access_token) {
      throw new Error(
        `Failed to exchange browser OAuth code: ${tokenData.error || JSON.stringify(tokenData)}`
      );
    }

    const refreshToken = tokenData.refresh_token || existing?.refreshToken;
    if (!refreshToken) {
      throw new Error("Zoho did not return a refresh_token. Please try again and click Accept.");
    }

    const expiresIn = Number(tokenData.expires_in || 3600);
    const newConfig: ZohoStoredConfig = {
      region,
      clientId: params.clientId.trim(),
      clientSecret: params.clientSecret.trim(),
      refreshToken,
      redirectUri,
      accessToken: tokenData.access_token,
      accessTokenExpiresAt: Date.now() + (expiresIn - 180) * 1000,
      booksOrgId: params.booksOrgId || existing?.booksOrgId,
      expectedUserEmail: params.expectedUserEmail || existing?.expectedUserEmail,
      branding: {
        ...(existing?.branding || {}),
        ...(params.branding || {}),
      },
      updatedAt: new Date().toISOString(),
    };

    const { crmConnected, booksConnected, discoveredBooksOrgs } =
      await this.enrichAndVerifyAccount(newConfig, tokenData.access_token);

    const userLabel = newConfig.authenticatedUser
      ? `${newConfig.authenticatedUser.fullName} <${newConfig.authenticatedUser.email}> (Profile: ${newConfig.authenticatedUser.profileName || "Standard"}, Role: ${newConfig.authenticatedUser.roleName || "Member"})`
      : "Authenticated User";

    return {
      config: newConfig,
      crmConnected,
      booksConnected,
      discoveredBooksOrgs,
      message: `Successfully logged in via browser as ${userLabel}! All Zoho actions will strictly follow this user's Zoho Profile & Role permissions.`,
    };
  }

  /**
   * Configures Zoho authentication using either a 1-time Self-Client Grant Token (code)
   * OR an existing Refresh Token. Also auto-discovers Zoho Books Organization ID and active User Profile.
   */
  public async configureCredentials(params: {
    clientId: string;
    clientSecret: string;
    grantToken?: string;
    refreshToken?: string;
    redirectUri?: string;
    region?: ZohoRegion;
    booksOrgId?: string;
    expectedUserEmail?: string;
    branding?: CompanyBranding;
  }): Promise<{
    config: ZohoStoredConfig;
    crmConnected: boolean;
    booksConnected: boolean;
    discoveredBooksOrgs: Array<{
      organization_id: string;
      name: string;
      is_default_org?: boolean;
    }>;
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
        const formParams: Record<string, string> = {
          grant_type: "authorization_code",
          client_id: clientId,
          client_secret: clientSecret,
          code,
        };
        if (params.redirectUri) {
          formParams.redirect_uri = params.redirectUri;
        }
        const body = new URLSearchParams(formParams);

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
            `Make sure you generated a fresh Grant Token in https://api-console.zoho.${region}/ ` +
            `and pasted it within its expiry window.`
        );
      }
    }

    if (!refreshToken) {
      throw new Error(
        "Either a 1-time `grantToken`, an existing `refreshToken`, or `zoho_auth_browser_login` is required."
      );
    }

    const newConfig: ZohoStoredConfig = {
      region,
      clientId,
      clientSecret,
      refreshToken,
      redirectUri: params.redirectUri || existing?.redirectUri,
      accessToken: accessToken || undefined,
      accessTokenExpiresAt: accessToken ? Date.now() + (expiresIn - 180) * 1000 : undefined,
      booksOrgId: params.booksOrgId || existing?.booksOrgId,
      expectedUserEmail: params.expectedUserEmail || existing?.expectedUserEmail,
      branding: {
        ...(existing?.branding || {}),
        ...(params.branding || {}),
      },
      updatedAt: new Date().toISOString(),
    };

    this.saveConfig(newConfig);

    if (!accessToken) {
      accessToken = await this.getAccessToken(true);
    }

    const { crmConnected, booksConnected, discoveredBooksOrgs } =
      await this.enrichAndVerifyAccount(newConfig, accessToken);

    const userSummary = newConfig.authenticatedUser
      ? ` as ${newConfig.authenticatedUser.fullName} (${newConfig.authenticatedUser.email} | Profile: ${newConfig.authenticatedUser.profileName || "Standard"})`
      : "";

    return {
      config: newConfig,
      crmConnected,
      booksConnected,
      discoveredBooksOrgs,
      message: `Successfully linked Zoho (${region.toUpperCase()})${userSummary} and stored at ${this.configPath}`,
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
          "Call `zoho_auth_browser_login` (for user-scoped browser login) or `zoho_auth_configure`."
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
