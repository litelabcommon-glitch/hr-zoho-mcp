import { booksClient } from "../clients/zoho-books.js";
import { ToolDefinition } from "./types.js";

export const booksTools: ToolDefinition[] = [
  {
    name: "books_sync_crm_client",
    description:
      "Simultaneously sync a Zoho CRM client (Account, Contact, Lead, or Deal) with Zoho Books. Automatically matches an existing Zoho Books Customer Contact or creates a new one from the CRM record's details, and logs a reference Note in Zoho CRM.",
    inputSchema: {
      type: "object",
      properties: {
        crmModule: {
          type: "string",
          enum: ["Accounts", "Contacts", "Leads", "Deals"],
          description: "Zoho CRM module where the client record lives.",
        },
        crmRecordId: {
          type: "string",
          description: "Zoho CRM Record ID to sync into Zoho Books.",
        },
      },
      required: ["crmModule", "crmRecordId"],
    },
    handler: async (args) => {
      return booksClient.syncCrmClientToBooks({
        crmModule: args.crmModule,
        crmRecordId: args.crmRecordId,
      });
    },
  },
  {
    name: "books_search_contacts",
    description:
      "Search or list Customer/Vendor Contacts in Zoho Books by name, company, email, or keyword.",
    inputSchema: {
      type: "object",
      properties: {
        searchText: { type: "string", description: "Keyword search across Zoho Books contacts." },
        contactName: { type: "string", description: "Filter by contact name." },
        companyName: { type: "string", description: "Filter by company name." },
        email: { type: "string", description: "Filter by email." },
        contactType: {
          type: "string",
          enum: ["customer", "vendor"],
          description: "Default: 'customer'.",
        },
      },
    },
    handler: async (args) => {
      const contacts = await booksClient.listContacts(args);
      return {
        count: contacts.length,
        contacts,
      };
    },
  },
  {
    name: "books_get_client_financials",
    description:
      "Get a client's complete Zoho Books financial snapshot: outstanding receivables, unused credits, all Estimates/Quotes, and all Invoices with their payment statuses.",
    inputSchema: {
      type: "object",
      properties: {
        customerId: {
          type: "string",
          description: "Zoho Books Customer Contact ID (`contact_id`).",
        },
      },
      required: ["customerId"],
    },
    handler: async (args) => {
      return booksClient.getClientFinancialSummary(args.customerId);
    },
  },
  {
    name: "books_create_estimate",
    description:
      "Create an Estimate (Quote / Commercial Proposal) for a client in Zoho Books.",
    inputSchema: {
      type: "object",
      properties: {
        customerId: {
          type: "string",
          description: "Zoho Books Customer Contact ID (`contact_id`).",
        },
        referenceNumber: { type: "string" },
        date: { type: "string", description: "Estimate date in YYYY-MM-DD format." },
        expiryDate: { type: "string", description: "Expiry date in YYYY-MM-DD format." },
        lineItems: {
          type: "array",
          description: "Line items for the estimate.",
          items: {
            type: "object",
            properties: {
              name: { type: "string", description: "Item or service title" },
              description: { type: "string", description: "Detailed deliverable/milestone description" },
              rate: { type: "number", description: "Unit price" },
              quantity: { type: "number", description: "Quantity (default 1)" },
              discount: { type: "string", description: "Optional discount (e.g. '10%' or '500')" },
            },
            required: ["name", "rate"],
          },
        },
        notes: { type: "string", description: "Customer-facing notes on the estimate." },
        terms: { type: "string", description: "Terms and conditions on the estimate." },
      },
      required: ["customerId", "lineItems"],
    },
    handler: async (args) => {
      return booksClient.createEstimate(args);
    },
  },
  {
    name: "books_create_invoice",
    description:
      "Create an Invoice for a client in Zoho Books with custom line items, due date, and terms.",
    inputSchema: {
      type: "object",
      properties: {
        customerId: {
          type: "string",
          description: "Zoho Books Customer Contact ID (`contact_id`).",
        },
        referenceNumber: { type: "string" },
        date: { type: "string", description: "Invoice date in YYYY-MM-DD format." },
        dueDate: { type: "string", description: "Due date in YYYY-MM-DD format." },
        paymentTerms: { type: "number", description: "Payment terms in days (e.g. 15 or 30)." },
        lineItems: {
          type: "array",
          description: "Invoice line items.",
          items: {
            type: "object",
            properties: {
              name: { type: "string" },
              description: { type: "string" },
              rate: { type: "number" },
              quantity: { type: "number" },
              discount: { type: "string" },
            },
            required: ["name", "rate"],
          },
        },
        notes: { type: "string" },
        terms: { type: "string" },
        markAsSent: {
          type: "boolean",
          description: "If true, transitions the newly created invoice from 'draft' to 'sent'.",
        },
      },
      required: ["customerId", "lineItems"],
    },
    handler: async (args) => {
      return booksClient.createInvoice(args);
    },
  },
  {
    name: "books_record_payment",
    description:
      "Record a customer payment against an Invoice in Zoho Books.",
    inputSchema: {
      type: "object",
      properties: {
        customerId: { type: "string", description: "Zoho Books Customer Contact ID" },
        invoiceId: { type: "string", description: "Zoho Books Invoice ID" },
        amount: { type: "number", description: "Payment amount received" },
        date: { type: "string", description: "Payment date (YYYY-MM-DD)" },
        paymentMode: {
          type: "string",
          description: "e.g., 'Bank Transfer', 'UPI', 'Cash', 'Credit Card', 'Check'",
        },
        referenceNumber: { type: "string", description: "Transaction / UTR reference number" },
        description: { type: "string" },
      },
      required: ["customerId", "invoiceId", "amount"],
    },
    handler: async (args) => {
      return booksClient.recordPayment(args);
    },
  },
];
