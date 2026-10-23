import fs from "node:fs";
import path from "node:path";
import { authManager } from "../config/auth-manager.js";

export interface ZohoCrmRequestOptions {
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  params?: Record<string, string | number | boolean | undefined>;
  body?: any;
  headers?: Record<string, string>;
}

export class ZohoCrmClient {
  private async request<T = any>(
    endpointPath: string,
    options: ZohoCrmRequestOptions = {},
    retried = false
  ): Promise<T> {
    const token = await authManager.getAccessToken(retried);
    const { crmApiUrl } = authManager.getEndpoints();

    const url = new URL(`${crmApiUrl}${endpointPath.startsWith("/") ? "" : "/"}${endpointPath}`);
    if (options.params) {
      for (const [k, v] of Object.entries(options.params)) {
        if (v !== undefined && v !== null && v !== "") {
          url.searchParams.set(k, String(v));
        }
      }
    }

    const headers: Record<string, string> = {
      Authorization: `Zoho-oauthtoken ${token}`,
      ...(options.headers || {}),
    };

    let fetchBody: any = undefined;
    if (options.body !== undefined) {
      if (options.body instanceof FormData) {
        fetchBody = options.body;
      } else {
        headers["Content-Type"] = "application/json";
        fetchBody = JSON.stringify(options.body);
      }
    }

    const resp = await fetch(url.toString(), {
      method: options.method || "GET",
      headers,
      body: fetchBody,
    });

    if (resp.status === 401 && !retried) {
      return this.request<T>(endpointPath, options, true);
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
      const errDetail = parsed?.message || parsed?.code || JSON.stringify(parsed);
      throw new Error(`Zoho CRM API Error (${resp.status} on ${endpointPath}): ${errDetail}`);
    }

    return parsed as T;
  }

  /**
   * Lists all available standard and custom modules in Zoho CRM.
   */
  public async listModules(): Promise<any[]> {
    const res = await this.request<{ modules: any[] }>("/settings/modules");
    return (res.modules || []).map((m) => ({
      api_name: m.api_name,
      plural_label: m.plural_label,
      singular_label: m.singular_label,
      generated_type: m.generated_type, // 'custom' or 'default'
      creatable: m.creatable,
      editable: m.editable,
      viewable: m.viewable,
    }));
  }

  /**
   * Retrieves fields and picklist values (e.g. Pipeline Stages, Lead Statuses) for a module.
   */
  public async getModuleFields(moduleName: string): Promise<any[]> {
    const res = await this.request<{ fields: any[] }>("/settings/fields", {
      params: { module: moduleName },
    });
    return (res.fields || []).map((f) => ({
      api_name: f.api_name,
      field_label: f.field_label,
      data_type: f.data_type,
      system_mandatory: f.system_mandatory,
      custom_field: f.custom_field,
      pick_list_values: Array.isArray(f.pick_list_values)
        ? f.pick_list_values.map((p: any) => p.actual_value || p.display_value)
        : undefined,
    }));
  }

  /**
   * Searches records in any Zoho CRM module (Leads, Contacts, Accounts, Deals, or Custom Modules).
   */
  public async searchRecords(params: {
    moduleName: string;
    word?: string;
    email?: string;
    phone?: string;
    criteria?: string;
    page?: number;
    perPage?: number;
  }): Promise<any[]> {
    const { moduleName, word, email, phone, criteria, page = 1, perPage = 20 } = params;

    if (word || email || phone || criteria) {
      const res = await this.request<{ data: any[] }>(`/${moduleName}/search`, {
        params: {
          word,
          email,
          phone,
          criteria,
          page,
          per_page: perPage,
        },
      });
      return res.data || [];
    }

    // If no search filter is passed, list the most recently modified records
    const res = await this.request<{ data: any[] }>(`/${moduleName}`, {
      params: {
        page,
        per_page: perPage,
        sort_by: "Modified_Time",
        sort_order: "desc",
      },
    });
    return res.data || [];
  }

  /**
   * Executes a COQL (CRM Object Query Language) SELECT query.
   */
  public async executeCOQL(selectQuery: string): Promise<any[]> {
    const res = await this.request<{ data: any[] }>("/coql", {
      method: "POST",
      body: { select_query: selectQuery },
    });
    return res.data || [];
  }

  /**
   * Fetches a single record by ID from any module.
   */
  public async getRecord(moduleName: string, recordId: string): Promise<any> {
    const res = await this.request<{ data: any[] }>(`/${moduleName}/${recordId}`);
    if (!res.data || res.data.length === 0) {
      throw new Error(`Record ${recordId} not found in module ${moduleName}`);
    }
    return res.data[0];
  }

  /**
   * Composite helper: Gets a client's full CRM profile including record data, recent Notes, Attachments, and open Tasks.
   */
  public async getClientFullProfile(moduleName: string, recordId: string): Promise<{
    record: any;
    notes: any[];
    attachments: any[];
  }> {
    const [record, notes, attachments] = await Promise.all([
      this.getRecord(moduleName, recordId),
      this.getNotes(moduleName, recordId).catch(() => []),
      this.listAttachments(moduleName, recordId).catch(() => []),
    ]);

    return {
      record,
      notes,
      attachments,
    };
  }

  /**
   * Creates a new record in any Zoho CRM module.
   */
  public async createRecord(
    moduleName: string,
    data: Record<string, any>,
    trigger: string[] = ["approval", "workflow", "blueprint"]
  ): Promise<any> {
    const res = await this.request<{ data: any[] }>(`/${moduleName}`, {
      method: "POST",
      body: {
        data: [data],
        trigger,
      },
    });
    const first = res.data?.[0];
    if (first?.status === "error") {
      throw new Error(`Failed to create ${moduleName} record: ${first.message} (${JSON.stringify(first.details)})`);
    }
    return first;
  }

  /**
   * Updates an existing record in any Zoho CRM module.
   */
  public async updateRecord(
    moduleName: string,
    recordId: string,
    data: Record<string, any>,
    trigger: string[] = ["approval", "workflow", "blueprint"]
  ): Promise<any> {
    const res = await this.request<{ data: any[] }>(`/${moduleName}/${recordId}`, {
      method: "PUT",
      body: {
        data: [{ id: recordId, ...data }],
        trigger,
      },
    });
    const first = res.data?.[0];
    if (first?.status === "error") {
      throw new Error(`Failed to update ${moduleName}/${recordId}: ${first.message} (${JSON.stringify(first.details)})`);
    }
    return first;
  }

  /**
   * Converts a Lead into a Contact, Account, and optionally a Deal.
   */
  public async convertLead(
    leadId: string,
    options: {
      overwrite?: boolean;
      notifyLeadOwner?: boolean;
      notifyNewEntityOwner?: boolean;
      assignToUserId?: string;
      dealData?: {
        Deal_Name: string;
        Stage: string;
        Closing_Date: string;
        Amount?: number;
        [key: string]: any;
      };
    } = {}
  ): Promise<any> {
    const conversionPayload: Record<string, any> = {
      overwrite: options.overwrite ?? true,
      notify_lead_owner: options.notifyLeadOwner ?? false,
      notify_new_entity_owner: options.notifyNewEntityOwner ?? false,
    };
    if (options.assignToUserId) {
      conversionPayload.assign_to = { id: options.assignToUserId };
    }
    if (options.dealData) {
      conversionPayload.Deals = options.dealData;
    }

    const res = await this.request<{ data: any[] }>(`/Leads/${leadId}/actions/convert`, {
      method: "POST",
      body: { data: [conversionPayload] },
    });
    return res.data?.[0] || res;
  }

  /**
   * Atomic Client Progress / Stage Swapper:
   * Safely transitions a client's Stage or Status, updates companion fields,
   * logs an audit trail Note on the record, and optionally schedules a follow-up Task.
   */
  public async advanceClientStage(params: {
    moduleName: string;
    recordId: string;
    newStage: string;
    stageFieldName?: string;
    reasonOrSummary: string;
    additionalFields?: Record<string, any>;
    followUpTask?: {
      subject: string;
      dueDate: string; // YYYY-MM-DD
      priority?: "High" | "Highest" | "Normal" | "Low" | "Lowest";
      description?: string;
    };
  }): Promise<{
    previousStage: string;
    newStage: string;
    updateResult: any;
    auditNote: any;
    followUpTaskResult?: any;
  }> {
    const {
      moduleName,
      recordId,
      newStage,
      stageFieldName = moduleName === "Leads" ? "Lead_Status" : "Stage",
      reasonOrSummary,
      additionalFields = {},
      followUpTask,
    } = params;

    // 1. Fetch current record to capture previous stage
    const existingRecord = await this.getRecord(moduleName, recordId);
    const previousStage = String(existingRecord[stageFieldName] || "Unset");
    const recordDisplayName =
      existingRecord.Deal_Name ||
      existingRecord.Full_Name ||
      existingRecord.Account_Name ||
      existingRecord.Name ||
      recordId;

    // 2. Perform the atomic field update
    const payload: Record<string, any> = {
      ...additionalFields,
      [stageFieldName]: newStage,
    };
    const updateResult = await this.updateRecord(moduleName, recordId, payload);

    // 3. Log an automatic Stage Transition Audit Note so client progress is always documented
    const timestamp = new Date().toISOString();
    const noteTitle = `[Stage Update] ${previousStage} → ${newStage}`;
    const noteContent = [
      `Client / Record: ${recordDisplayName}`,
      `Stage Field (${stageFieldName}): "${previousStage}" → "${newStage}"`,
      `Timestamp: ${timestamp}`,
      `HR Progress Summary / Reason:`,
      reasonOrSummary,
      Object.keys(additionalFields).length > 0
        ? `\nAdditional Updated Fields: ${JSON.stringify(additionalFields)}`
        : "",
    ]
      .filter(Boolean)
      .join("\n");

    const auditNote = await this.addNote(moduleName, recordId, noteTitle, noteContent);

    // 4. Create optional follow-up Task
    let followUpTaskResult: any = undefined;
    if (followUpTask) {
      followUpTaskResult = await this.createTask({
        subject: followUpTask.subject,
        dueDate: followUpTask.dueDate,
        priority: followUpTask.priority || "High",
        description:
          followUpTask.description ||
          `Follow-up task triggered after advancing ${recordDisplayName} to "${newStage}".\nContext: ${reasonOrSummary}`,
        relatedModule: moduleName,
        relatedRecordId: recordId,
      });
    }

    return {
      previousStage,
      newStage,
      updateResult,
      auditNote,
      followUpTaskResult,
    };
  }

  /**
   * Adds a Note to a specific CRM record.
   */
  public async addNote(
    moduleName: string,
    recordId: string,
    title: string,
    content: string
  ): Promise<any> {
    const res = await this.request<{ data: any[] }>(`/${moduleName}/${recordId}/Notes`, {
      method: "POST",
      body: {
        data: [
          {
            Note_Title: title,
            Note_Content: content,
          },
        ],
      },
    });
    return res.data?.[0] || res;
  }

  /**
   * Lists Notes attached to a specific CRM record.
   */
  public async getNotes(moduleName: string, recordId: string, perPage = 20): Promise<any[]> {
    const res = await this.request<{ data: any[] }>(`/${moduleName}/${recordId}/Notes`, {
      params: {
        per_page: perPage,
        sort_by: "Created_Time",
        sort_order: "desc",
      },
    });
    return (res.data || []).map((n) => ({
      id: n.id,
      title: n.Note_Title,
      content: n.Note_Content,
      created_time: n.Created_Time,
      created_by: n.Created_By?.name,
    }));
  }

  /**
   * Logs an outbound or inbound Call activity in Zoho CRM `Calls` module.
   */
  public async logCallActivity(params: {
    subject: string;
    callType?: "Outbound" | "Inbound" | "Missed";
    callDurationMinutes?: number;
    description: string;
    callResult?: string;
    relatedModule: string;
    relatedRecordId: string;
  }): Promise<any> {
    const durationMin = params.callDurationMinutes ?? 15;
    const mins = String(Math.floor(durationMin)).padStart(2, "0");
    const callData: Record<string, any> = {
      Subject: params.subject,
      Call_Type: params.callType || "Outbound",
      Call_Status: "Completed",
      Call_Start_Time: new Date().toISOString().replace(/\.\d{3}Z$/, "+00:00"),
      Call_Duration: `${mins}:00`,
      Description: params.description,
      Call_Result: params.callResult || "Interested",
      $se_module: params.relatedModule,
    };

    if (params.relatedModule === "Contacts" || params.relatedModule === "Leads") {
      callData.Who_Id = { id: params.relatedRecordId };
    } else {
      callData.What_Id = { id: params.relatedRecordId };
    }

    return this.createRecord("Calls", callData);
  }

  /**
   * Creates a Task in Zoho CRM `Tasks` module linked to a Lead, Contact, Account, Deal, or Custom Module.
   */
  public async createTask(params: {
    subject: string;
    dueDate: string; // YYYY-MM-DD
    status?: "Not Started" | "Deferred" | "In Progress" | "Completed" | "Waiting for input";
    priority?: "High" | "Highest" | "Normal" | "Low" | "Lowest";
    description?: string;
    relatedModule?: string;
    relatedRecordId?: string;
  }): Promise<any> {
    const taskData: Record<string, any> = {
      Subject: params.subject,
      Due_Date: params.dueDate,
      Status: params.status || "Not Started",
      Priority: params.priority || "Normal",
      Description: params.description || "",
    };

    if (params.relatedModule && params.relatedRecordId) {
      taskData.$se_module = params.relatedModule;
      if (params.relatedModule === "Contacts" || params.relatedModule === "Leads") {
        taskData.Who_Id = { id: params.relatedRecordId };
      } else {
        taskData.What_Id = { id: params.relatedRecordId };
      }
    }

    return this.createRecord("Tasks", taskData);
  }

  /**
   * High-level HR Conversation Logger:
   * Logs a detailed HR conversation (from call, meeting, WhatsApp, or email) as a CRM Note,
   * optionally logs a Call entry, updates client fields if requested, and creates follow-up Tasks.
   */
  public async logHrConversation(params: {
    moduleName: string;
    recordId: string;
    channel: "Phone Call" | "Video Meeting" | "WhatsApp / Chat" | "Email" | "In-Person";
    subject: string;
    summary: string;
    keyDecisionsOrUpdates?: string[];
    rawTranscriptSnippet?: string;
    logAsCallActivity?: boolean;
    callDurationMinutes?: number;
    fieldUpdates?: Record<string, any>;
    followUpTasks?: Array<{
      subject: string;
      dueDate: string;
      priority?: "High" | "Highest" | "Normal" | "Low" | "Lowest";
    }>;
  }): Promise<{
    noteResult: any;
    callResult?: any;
    fieldUpdateResult?: any;
    tasksCreated: any[];
  }> {
    const lines: string[] = [
      `Channel: ${params.channel}`,
      `Date: ${new Date().toISOString()}`,
      ``,
      `=== HR Conversation Summary ===`,
      params.summary,
    ];

    if (params.keyDecisionsOrUpdates && params.keyDecisionsOrUpdates.length > 0) {
      lines.push(``, `=== Key Decisions & Client Updates ===`);
      for (const item of params.keyDecisionsOrUpdates) {
        lines.push(`• ${item}`);
      }
    }

    if (params.rawTranscriptSnippet) {
      lines.push(``, `=== Conversation Excerpt / Raw Notes ===`, params.rawTranscriptSnippet);
    }

    const noteTitle = `[HR ${params.channel}] ${params.subject}`;
    const noteResult = await this.addNote(
      params.moduleName,
      params.recordId,
      noteTitle,
      lines.join("\n")
    );

    let callResult: any = undefined;
    if (params.logAsCallActivity || params.channel === "Phone Call" || params.channel === "Video Meeting") {
      try {
        callResult = await this.logCallActivity({
          subject: params.subject,
          callType: "Outbound",
          callDurationMinutes: params.callDurationMinutes || 15,
          description: lines.join("\n"),
          relatedModule: params.moduleName,
          relatedRecordId: params.recordId,
        });
      } catch (err: any) {
        callResult = { warning: `Note saved, but Call activity log returned: ${err.message}` };
      }
    }

    let fieldUpdateResult: any = undefined;
    if (params.fieldUpdates && Object.keys(params.fieldUpdates).length > 0) {
      fieldUpdateResult = await this.updateRecord(
        params.moduleName,
        params.recordId,
        params.fieldUpdates
      );
    }

    const tasksCreated: any[] = [];
    if (params.followUpTasks && params.followUpTasks.length > 0) {
      for (const t of params.followUpTasks) {
        const created = await this.createTask({
          subject: t.subject,
          dueDate: t.dueDate,
          priority: t.priority || "High",
          description: `Follow-up from HR ${params.channel}: ${params.subject}`,
          relatedModule: params.moduleName,
          relatedRecordId: params.recordId,
        });
        tasksCreated.push(created);
      }
    }

    return {
      noteResult,
      callResult,
      fieldUpdateResult,
      tasksCreated,
    };
  }

  /**
   * Lists Attachments on a Zoho CRM record.
   */
  public async listAttachments(moduleName: string, recordId: string): Promise<any[]> {
    const res = await this.request<{ data: any[] }>(`/${moduleName}/${recordId}/Attachments`);
    return (res.data || []).map((a) => ({
      id: a.id,
      file_name: a.File_Name,
      size: a.Size,
      created_time: a.Created_Time,
      created_by: a.Created_By?.name,
    }));
  }

  /**
   * Uploads a local file (.docx, .pdf, etc.) directly as an Attachment to a Zoho CRM record.
   */
  public async uploadAttachment(
    moduleName: string,
    recordId: string,
    filePath: string
  ): Promise<any> {
    if (!fs.existsSync(filePath)) {
      throw new Error(`Attachment file does not exist at path: ${filePath}`);
    }

    const fileBuffer = fs.readFileSync(filePath);
    const fileName = path.basename(filePath);
    const blob = new Blob([fileBuffer]);
    const formData = new FormData();
    formData.append("file", blob, fileName);

    const res = await this.request<{ data: any[] }>(`/${moduleName}/${recordId}/Attachments`, {
      method: "POST",
      body: formData,
    });

    return res.data?.[0] || res;
  }
}

export const crmClient = new ZohoCrmClient();
