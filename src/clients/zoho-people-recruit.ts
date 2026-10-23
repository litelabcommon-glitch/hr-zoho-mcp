import { authManager } from "../config/auth-manager.js";

export class ZohoPeopleRecruitClient {
  /**
   * Calls Zoho Recruit v2 REST API (e.g. Candidates, Job_Openings, Interviews, Applications, Clients).
   */
  public async recruitRequest<T = any>(
    endpointPath: string,
    options: {
      method?: "GET" | "POST" | "PUT" | "DELETE";
      params?: Record<string, string | number | boolean | undefined>;
      body?: any;
    } = {},
    retried = false
  ): Promise<T> {
    const token = await authManager.getAccessToken(retried);
    const { recruitApiUrl } = authManager.getEndpoints();

    const url = new URL(
      `${recruitApiUrl}${endpointPath.startsWith("/") ? "" : "/"}${endpointPath}`
    );
    if (options.params) {
      for (const [k, v] of Object.entries(options.params)) {
        if (v !== undefined && v !== null && v !== "") {
          url.searchParams.set(k, String(v));
        }
      }
    }

    const headers: Record<string, string> = {
      Authorization: `Zoho-oauthtoken ${token}`,
    };
    if (options.body !== undefined) {
      headers["Content-Type"] = "application/json";
    }

    const resp = await fetch(url.toString(), {
      method: options.method || "GET",
      headers,
      body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
    });

    if (resp.status === 401 && !retried) {
      return this.recruitRequest<T>(endpointPath, options, true);
    }

    if (resp.status === 204) {
      return { data: [] } as unknown as T;
    }

    const text = await resp.text();
    let parsed: any;
    try {
      parsed = text ? JSON.parse(text) : {};
    } catch {
      parsed = { raw: text };
    }

    if (!resp.ok) {
      throw new Error(
        `Zoho Recruit API Error (${resp.status} on ${endpointPath}): ${JSON.stringify(parsed)}`
      );
    }

    return parsed as T;
  }

  /**
   * Calls Zoho People REST API (e.g. forms, employee records, attendance, leave, onboarding).
   */
  public async peopleRequest<T = any>(
    endpointPath: string,
    options: {
      method?: "GET" | "POST";
      params?: Record<string, string | number | boolean | undefined>;
      formDataParams?: Record<string, string>;
    } = {},
    retried = false
  ): Promise<T> {
    const token = await authManager.getAccessToken(retried);
    const { peopleApiUrl } = authManager.getEndpoints();

    const url = new URL(
      `${peopleApiUrl}${endpointPath.startsWith("/") ? "" : "/"}${endpointPath}`
    );
    if (options.params) {
      for (const [k, v] of Object.entries(options.params)) {
        if (v !== undefined && v !== null && v !== "") {
          url.searchParams.set(k, String(v));
        }
      }
    }

    const headers: Record<string, string> = {
      Authorization: `Zoho-oauthtoken ${token}`,
    };

    let body: string | undefined = undefined;
    if (options.formDataParams) {
      headers["Content-Type"] = "application/x-www-form-urlencoded";
      body = new URLSearchParams(options.formDataParams).toString();
    }

    const resp = await fetch(url.toString(), {
      method: options.method || "GET",
      headers,
      body,
    });

    if (resp.status === 401 && !retried) {
      return this.peopleRequest<T>(endpointPath, options, true);
    }

    const text = await resp.text();
    let parsed: any;
    try {
      parsed = text ? JSON.parse(text) : {};
    } catch {
      parsed = { raw: text };
    }

    if (!resp.ok) {
      throw new Error(
        `Zoho People API Error (${resp.status} on ${endpointPath}): ${JSON.stringify(parsed)}`
      );
    }

    return parsed as T;
  }

  /**
   * Searches or lists records in Zoho Recruit (e.g., Candidates, Job_Openings, Clients, Contacts).
   */
  public async searchRecruitRecords(params: {
    moduleName: string; // e.g. 'Candidates' | 'Job_Openings' | 'Clients' | 'Interviews'
    word?: string;
    criteria?: string;
    page?: number;
    perPage?: number;
  }): Promise<any[]> {
    const { moduleName, word, criteria, page = 1, perPage = 20 } = params;
    if (word || criteria) {
      const res = await this.recruitRequest<{ data: any[] }>(`/${moduleName}/search`, {
        params: { word, criteria, page, per_page: perPage },
      });
      return res.data || [];
    }
    const res = await this.recruitRequest<{ data: any[] }>(`/${moduleName}`, {
      params: { page, per_page: perPage },
    });
    return res.data || [];
  }

  /**
   * Creates or updates a record in Zoho Recruit (e.g., Candidate status, Job Opening, Interview).
   */
  public async upsertRecruitRecord(params: {
    moduleName: string;
    recordId?: string;
    data: Record<string, any>;
  }): Promise<any> {
    if (params.recordId) {
      return this.recruitRequest(`/${params.moduleName}/${params.recordId}`, {
        method: "PUT",
        body: { data: [{ id: params.recordId, ...params.data }] },
      });
    }
    return this.recruitRequest(`/${params.moduleName}`, {
      method: "POST",
      body: { data: [params.data] },
    });
  }

  /**
   * Lists Zoho People forms or fetches records from a specific Zoho People form (e.g., 'employee', 'onboarding').
   */
  public async getPeopleRecords(params: {
    formLinkName?: string;
    searchColumn?: string;
    searchValue?: string;
    sIndex?: number;
    limit?: number;
  }): Promise<any> {
    if (!params.formLinkName) {
      return this.peopleRequest("/forms");
    }

    const queryParams: Record<string, string | number | undefined> = {
      sIndex: params.sIndex || 1,
      limit: params.limit || 50,
    };

    if (params.searchColumn && params.searchValue) {
      queryParams.searchParams = JSON.stringify({
        searchField: params.searchColumn,
        searchOperator: "Contains",
        searchText: params.searchValue,
      });
    }

    return this.peopleRequest(`/forms/${params.formLinkName}/getRecords`, {
      params: queryParams,
    });
  }

  /**
   * Adds or updates a record in a Zoho People form (e.g., adding a new hire or updating HR onboarding status).
   */
  public async upsertPeopleRecord(params: {
    formLinkName: string;
    recordId?: string;
    inputData: Record<string, any>;
  }): Promise<any> {
    const endpoint = params.recordId
      ? `/forms/json/${params.formLinkName}/updateRecord`
      : `/forms/json/${params.formLinkName}/insertRecord`;

    const formDataParams: Record<string, string> = {
      inputData: JSON.stringify(params.inputData),
    };
    if (params.recordId) {
      formDataParams.recordId = params.recordId;
    }

    return this.peopleRequest(endpoint, {
      method: "POST",
      formDataParams,
    });
  }
}

export const peopleRecruitClient = new ZohoPeopleRecruitClient();
