import fs from "node:fs";
import path from "node:path";
import { authManager } from "../config/auth-manager.js";
import { crmClient } from "./zoho-crm.js";

export interface ZohoBooksRequestOptions {
  method?: "GET" | "POST" | "PUT" | "DELETE";
  params?: Record<string, string | number | boolean | undefined>;
  body?: any;
  skipOrgId?: boolean;
}

export class ZohoBooksClient {
  private async ensureOrgId(): Promise<string> {
    const cfg = authManager.loadConfig();
    if (cfg?.booksOrgId) {
      return cfg.booksOrgId;
    }

    const orgs = await this.listOrganizations();
    if (orgs.length === 0) {
      throw new Error(
        "No Zoho Books organizations found for this Zoho account. Verify Zoho Books is enabled and your Self-Client includes scope `ZohoBooks.fullaccess.all`."
      );
    }

    const chosen = orgs.find((o: any) => o.is_default_org) || orgs[0];
    if (cfg) {
      cfg.booksOrgId = String(chosen.organization_id);
      cfg.booksOrgName = String(chosen.name);
      authManager.saveConfig(cfg);
    }
    return String(chosen.organization_id);
  }

  public async request<T = any>(
    endpointPath: string,
    options: ZohoBooksRequestOptions = {},
    retried = false
  ): Promise<T> {
    const token = await authManager.getAccessToken(retried);
    const { booksApiUrl } = authManager.getEndpoints();

    const url = new URL(
      `${booksApiUrl}${endpointPath.startsWith("/") ? "" : "/"}${endpointPath}`
    );

    if (!options.skipOrgId) {
      const orgId = await this.ensureOrgId();
      url.searchParams.set("organization_id", orgId);
    }

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

    const text = await resp.text();
    let parsed: any;
    try {
      parsed = text ? JSON.parse(text) : {};
    } catch {
      parsed = { raw: text };
    }

    if (!resp.ok || (parsed?.code !== undefined && parsed.code !== 0)) {
      const msg = parsed?.message || resp.statusText;
      throw new Error(`Zoho Books API Error (${resp.status} on ${endpointPath}): ${msg}`);
    }

    return parsed as T;
  }

  /**
   * Lists Zoho Books organizations linked to the authenticated user.
   */
  public async listOrganizations(): Promise<any[]> {
    const res = await this.request<{ organizations: any[] }>("/organizations", {
      skipOrgId: true,
    });
    return res.organizations || [];
  }

  /**
   * Lists or searches Zoho Books Contacts (customers/vendors).
   */
  public async listContacts(params: {
    searchText?: string;
    contactName?: string;
    email?: string;
    companyName?: string;
    contactType?: "customer" | "vendor";
    page?: number;
    perPage?: number;
  } = {}): Promise<any[]> {
    const res = await this.request<{ contacts: any[] }>("/contacts", {
      params: {
        search_text: params.searchText,
        contact_name_contains: params.contactName,
        email_contains: params.email,
        company_name_contains: params.companyName,
        contact_type: params.contactType || "customer",
        page: params.page || 1,
        per_page: params.perPage || 25,
      },
    });
    return res.contacts || [];
  }

  /**
   * Gets full details of a Zoho Books Contact by ID.
   */
  public async getContact(contactId: string): Promise<any> {
    const res = await this.request<{ contact: any }>(`/contacts/${contactId}`);
    return res.contact;
  }

  /**
   * Creates a new Customer/Vendor Contact in Zoho Books.
   */
  public async createContact(data: {
    contact_name: string;
    company_name?: string;
    contact_type?: "customer" | "vendor";
    email?: string;
    phone?: string;
    billing_address?: {
      attention?: string;
      address?: string;
      city?: string;
      state?: string;
      zip?: string;
      country?: string;
    };
    notes?: string;
    custom_fields?: Array<{ label?: string; index?: number; value: any }>;
  }): Promise<any> {
    const contactPersons =
      data.email || data.phone
        ? [
            {
              first_name: data.contact_name.split(" ")[0] || data.contact_name,
              last_name: data.contact_name.split(" ").slice(1).join(" ") || "",
              email: data.email || "",
              phone: data.phone || "",
              is_primary_contact: true,
            },
          ]
        : undefined;

    const payload: Record<string, any> = {
      contact_name: data.contact_name,
      company_name: data.company_name || data.contact_name,
      contact_type: data.contact_type || "customer",
      billing_address: data.billing_address,
      notes: data.notes,
      contact_persons: contactPersons,
      custom_fields: data.custom_fields,
    };

    const res = await this.request<{ contact: any }>("/contacts", {
      method: "POST",
      body: payload,
    });
    return res.contact;
  }

  /**
   * Simultaneously syncs a Zoho CRM record (Account, Contact, Lead, or Deal) to a Zoho Books Customer Contact.
   * Finds an existing matching Zoho Books Contact or creates a new one, then logs the sync on the CRM record.
   */
  public async syncCrmClientToBooks(params: {
    crmModule: "Accounts" | "Contacts" | "Leads" | "Deals";
    crmRecordId: string;
  }): Promise<{
    action: "matched_existing" | "created_new";
    booksContact: any;
    crmRecordSummary: { id: string; name: string; email?: string };
  }> {
    const crmRecord = await crmClient.getRecord(params.crmModule, params.crmRecordId);

    const name =
      crmRecord.Account_Name?.name ||
      crmRecord.Account_Name ||
      crmRecord.Company ||
      crmRecord.Full_Name ||
      crmRecord.Deal_Name ||
      crmRecord.Name ||
      `CRM Client ${params.crmRecordId}`;

    const companyName =
      crmRecord.Account_Name?.name ||
      crmRecord.Account_Name ||
      crmRecord.Company ||
      name;

    const email = crmRecord.Email || crmRecord.Secondary_Email || undefined;
    const phone = crmRecord.Phone || crmRecord.Mobile || undefined;

    const billingAddress = {
      address: crmRecord.Billing_Street || crmRecord.Mailing_Street || crmRecord.Street || undefined,
      city: crmRecord.Billing_City || crmRecord.Mailing_City || crmRecord.City || undefined,
      state: crmRecord.Billing_State || crmRecord.Mailing_State || crmRecord.State || undefined,
      zip: crmRecord.Billing_Code || crmRecord.Mailing_Zip || crmRecord.Zip_Code || undefined,
      country:
        crmRecord.Billing_Country || crmRecord.Mailing_Country || crmRecord.Country || undefined,
    };

    // 1. Search Zoho Books by email first, then by contact_name
    let existingContacts: any[] = [];
    if (email) {
      existingContacts = await this.listContacts({ email });
    }
    if (existingContacts.length === 0) {
      existingContacts = await this.listContacts({ contactName: String(name) });
    }

    if (existingContacts.length > 0) {
      const matched = existingContacts[0];
      return {
        action: "matched_existing",
        booksContact: matched,
        crmRecordSummary: { id: params.crmRecordId, name: String(name), email },
      };
    }

    // 2. Create a new Zoho Books Customer Contact
    const created = await this.createContact({
      contact_name: String(name),
      company_name: String(companyName),
      contact_type: "customer",
      email,
      phone,
      billing_address: billingAddress,
      notes: `Auto-synced from Zoho CRM (${params.crmModule} ID: ${params.crmRecordId})`,
    });

    // 3. Log a Note in Zoho CRM linking the Books Contact ID
    await crmClient
      .addNote(
        params.crmModule,
        params.crmRecordId,
        `[Zoho Books Sync] Customer Profile Created`,
        `Synced client "${name}" with Zoho Books.\nZoho Books Contact ID: ${created.contact_id}\nCompany: ${companyName}`
      )
      .catch(() => undefined);

    return {
      action: "created_new",
      booksContact: created,
      crmRecordSummary: { id: params.crmRecordId, name: String(name), email },
    };
  }

  /**
   * Lists Estimates (Quotes) in Zoho Books, optionally filtered by customerId or status.
   */
  public async listEstimates(params: {
    customerId?: string;
    status?: "draft" | "sent" | "invoiced" | "accepted" | "declined" | "expired";
    searchText?: string;
  } = {}): Promise<any[]> {
    const res = await this.request<{ estimates: any[] }>("/estimates", {
      params: {
        customer_id: params.customerId,
        status: params.status,
        search_text: params.searchText,
      },
    });
    return res.estimates || [];
  }

  /**
   * Creates an Estimate (Quote / Financial Proposal) in Zoho Books.
   */
  public async createEstimate(params: {
    customerId: string;
    referenceNumber?: string;
    date?: string; // YYYY-MM-DD
    expiryDate?: string; // YYYY-MM-DD
    lineItems: Array<{
      name: string;
      description?: string;
      rate: number;
      quantity?: number;
      discount?: string | number;
    }>;
    notes?: string;
    terms?: string;
  }): Promise<any> {
    const payload: Record<string, any> = {
      customer_id: params.customerId,
      reference_number: params.referenceNumber,
      date: params.date,
      expiry_date: params.expiryDate,
      line_items: params.lineItems.map((item) => ({
        name: item.name,
        description: item.description || "",
        rate: item.rate,
        quantity: item.quantity ?? 1,
        discount: item.discount,
      })),
      notes: params.notes,
      terms: params.terms,
    };

    const res = await this.request<{ estimate: any }>("/estimates", {
      method: "POST",
      body: payload,
    });
    return res.estimate;
  }

  /**
   * Lists Invoices in Zoho Books, optionally filtered by customerId or status.
   */
  public async listInvoices(params: {
    customerId?: string;
    status?: "sent" | "draft" | "overdue" | "paid" | "void" | "unpaid" | "partially_paid";
    searchText?: string;
  } = {}): Promise<any[]> {
    const res = await this.request<{ invoices: any[] }>("/invoices", {
      params: {
        customer_id: params.customerId,
        status: params.status,
        search_text: params.searchText,
      },
    });
    return res.invoices || [];
  }

  /**
   * Creates an Invoice in Zoho Books.
   */
  public async createInvoice(params: {
    customerId: string;
    referenceNumber?: string;
    date?: string; // YYYY-MM-DD
    dueDate?: string; // YYYY-MM-DD
    paymentTerms?: number;
    lineItems: Array<{
      name: string;
      description?: string;
      rate: number;
      quantity?: number;
      discount?: string | number;
    }>;
    notes?: string;
    terms?: string;
    markAsSent?: boolean;
  }): Promise<any> {
    const payload: Record<string, any> = {
      customer_id: params.customerId,
      reference_number: params.referenceNumber,
      date: params.date,
      due_date: params.dueDate,
      payment_terms: params.paymentTerms,
      line_items: params.lineItems.map((item) => ({
        name: item.name,
        description: item.description || "",
        rate: item.rate,
        quantity: item.quantity ?? 1,
        discount: item.discount,
      })),
      notes: params.notes,
      terms: params.terms,
    };

    const res = await this.request<{ invoice: any }>("/invoices", {
      method: "POST",
      body: payload,
    });

    const invoice = res.invoice;
    if (params.markAsSent && invoice?.invoice_id) {
      await this.request(`/invoices/${invoice.invoice_id}/status/sent`, {
        method: "POST",
      }).catch(() => undefined);
      invoice.status = "sent";
    }

    return invoice;
  }

  /**
   * Records a Customer Payment against an Invoice in Zoho Books.
   */
  public async recordPayment(params: {
    customerId: string;
    invoiceId: string;
    amount: number;
    date?: string; // YYYY-MM-DD
    paymentMode?: string; // e.g., 'Bank Transfer', 'Cash', 'Check', 'Credit Card'
    referenceNumber?: string;
    description?: string;
  }): Promise<any> {
    const payload = {
      customer_id: params.customerId,
      payment_mode: params.paymentMode || "Bank Transfer",
      amount: params.amount,
      date: params.date || new Date().toISOString().slice(0, 10),
      reference_number: params.referenceNumber,
      description: params.description,
      invoices: [
        {
          invoice_id: params.invoiceId,
          amount_applied: params.amount,
        },
      ],
    };

    const res = await this.request<{ payment: any }>("/customerpayments", {
      method: "POST",
      body: payload,
    });
    return res.payment;
  }

  /**
   * Retrieves a unified financial snapshot for a Zoho Books customer:
   * Contact balances + Estimates + Invoices.
   */
  public async getClientFinancialSummary(customerId: string): Promise<{
    contact: any;
    estimates: any[];
    invoices: any[];
    summary: {
      currencyCode: string;
      outstandingReceivable: number;
      unusedCredits: number;
      totalInvoices: number;
      unpaidOrOverdueInvoices: number;
      totalEstimates: number;
    };
  }> {
    const [contact, estimates, invoices] = await Promise.all([
      this.getContact(customerId),
      this.listEstimates({ customerId }),
      this.listInvoices({ customerId }),
    ]);

    const unpaidCount = invoices.filter((inv) =>
      ["unpaid", "overdue", "partially_paid", "sent"].includes(inv.status)
    ).length;

    return {
      contact: {
        contact_id: contact.contact_id,
        contact_name: contact.contact_name,
        company_name: contact.company_name,
        email: contact.email,
        phone: contact.phone,
        status: contact.status,
      },
      estimates,
      invoices,
      summary: {
        currencyCode: contact.currency_code || "INR",
        outstandingReceivable: Number(contact.outstanding_receivable_amount || 0),
        unusedCredits: Number(contact.unused_credits_receivable_amount || 0),
        totalInvoices: invoices.length,
        unpaidOrOverdueInvoices: unpaidCount,
        totalEstimates: estimates.length,
      },
    };
  }

  /**
   * Uploads a generated file (.docx / .pdf) as an attachment to a Zoho Books Estimate or Invoice.
   */
  public async uploadBooksAttachment(params: {
    entityType: "estimates" | "invoices";
    entityId: string;
    filePath: string;
  }): Promise<any> {
    if (!fs.existsSync(params.filePath)) {
      throw new Error(`Attachment file not found at ${params.filePath}`);
    }

    const fileBuffer = fs.readFileSync(params.filePath);
    const fileName = path.basename(params.filePath);
    const blob = new Blob([fileBuffer]);
    const formData = new FormData();
    formData.append("attachment", blob, fileName);

    return this.request(`/${params.entityType}/${params.entityId}/attachment`, {
      method: "POST",
      body: formData,
    });
  }
}

export const booksClient = new ZohoBooksClient();
