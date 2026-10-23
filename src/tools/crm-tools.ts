import { crmClient } from "../clients/zoho-crm.js";
import { ToolDefinition } from "./types.js";

export const crmTools: ToolDefinition[] = [
  {
    name: "crm_list_modules_and_fields",
    description:
      "List all standard and custom modules in Zoho CRM, or inspect fields and picklist values (such as Deal Pipeline Stages or Lead Statuses) for a specific module.",
    inputSchema: {
      type: "object",
      properties: {
        moduleName: {
          type: "string",
          description:
            "Optional module API name (e.g. 'Deals', 'Leads', 'Contacts', 'Accounts', or a custom module name). If provided, returns all fields and valid picklist values for that module. If omitted, lists all modules.",
        },
      },
    },
    handler: async (args) => {
      if (args?.moduleName) {
        const fields = await crmClient.getModuleFields(args.moduleName);
        return {
          moduleName: args.moduleName,
          totalFields: fields.length,
          fields,
        };
      }
      const modules = await crmClient.listModules();
      return {
        totalModules: modules.length,
        modules,
      };
    },
  },
  {
    name: "crm_search_records",
    description:
      "Search or list records in any Zoho CRM module (Leads, Contacts, Accounts, Deals, or Custom Modules) by keyword, email, phone, criteria, or COQL query.",
    inputSchema: {
      type: "object",
      properties: {
        moduleName: {
          type: "string",
          description:
            "Module API name: 'Leads', 'Contacts', 'Accounts', 'Deals', 'Tasks', or any custom module name.",
        },
        word: {
          type: "string",
          description: "Global keyword search across record fields (e.g. client or company name).",
        },
        email: {
          type: "string",
          description: "Search by exact or partial email address.",
        },
        phone: {
          type: "string",
          description: "Search by phone number.",
        },
        criteria: {
          type: "string",
          description:
            "Optional Zoho CRM search criteria string, e.g., '((Stage:equals:Qualification)and(Amount:greater_than:50000))'.",
        },
        coqlQuery: {
          type: "string",
          description:
            "Optional full COQL SELECT query (e.g. \"select Deal_Name, Stage, Amount from Deals where Stage = 'Negotiation' limit 20\"). Overrides standard search if provided.",
        },
        perPage: {
          type: "number",
          description: "Maximum records to return (default 20).",
        },
      },
      required: ["moduleName"],
    },
    handler: async (args) => {
      if (args.coqlQuery) {
        const records = await crmClient.executeCOQL(args.coqlQuery);
        return { count: records.length, records };
      }

      const records = await crmClient.searchRecords({
        moduleName: args.moduleName,
        word: args.word,
        email: args.email,
        phone: args.phone,
        criteria: args.criteria,
        perPage: args.perPage || 20,
      });

      return {
        moduleName: args.moduleName,
        count: records.length,
        records,
      };
    },
  },
  {
    name: "crm_get_client_full_profile",
    description:
      "Retrieve a client's complete Zoho CRM profile including all record fields, chronological HR Notes, and uploaded file Attachments in one call.",
    inputSchema: {
      type: "object",
      properties: {
        moduleName: {
          type: "string",
          description: "Module API name (e.g. 'Deals', 'Contacts', 'Accounts', 'Leads').",
        },
        recordId: {
          type: "string",
          description: "Zoho CRM Record ID.",
        },
      },
      required: ["moduleName", "recordId"],
    },
    handler: async (args) => {
      return crmClient.getClientFullProfile(args.moduleName, args.recordId);
    },
  },
  {
    name: "crm_create_or_update_record",
    description:
      "Create a new record or update an existing record in any Zoho CRM module (Leads, Contacts, Accounts, Deals, or Custom Modules).",
    inputSchema: {
      type: "object",
      properties: {
        moduleName: {
          type: "string",
          description: "Module API name (e.g. 'Leads', 'Contacts', 'Accounts', 'Deals').",
        },
        recordId: {
          type: "string",
          description:
            "Provide `recordId` to update an existing record, or omit `recordId` to create a new record.",
        },
        data: {
          type: "object",
          description:
            "Key-value object of Zoho CRM field API names and values (e.g. { Last_Name: 'Sharma', Company: 'Acme Corp', Email: 'rahul@acme.com', Phone: '+919876543210' }).",
        },
      },
      required: ["moduleName", "data"],
    },
    handler: async (args) => {
      if (args.recordId) {
        const res = await crmClient.updateRecord(args.moduleName, args.recordId, args.data);
        return { action: "updated", moduleName: args.moduleName, recordId: args.recordId, result: res };
      }
      const res = await crmClient.createRecord(args.moduleName, args.data);
      return { action: "created", moduleName: args.moduleName, result: res };
    },
  },
  {
    name: "crm_advance_client_stage",
    description:
      "Atomic Client Progress Swapper: Safely move a client Deal, Lead, or Custom Record to a new Stage/Status, update companion fields, automatically log a timestamped Stage Transition Audit Note on the record, and optionally schedule a follow-up Task.",
    inputSchema: {
      type: "object",
      properties: {
        moduleName: {
          type: "string",
          description: "Module API name (typically 'Deals', 'Leads', or a custom onboarding module).",
        },
        recordId: {
          type: "string",
          description: "Zoho CRM Record ID of the client/deal.",
        },
        newStage: {
          type: "string",
          description: "Target stage or status value (e.g. 'Qualification', 'Proposal/Price Quote', 'Negotiation/Review', 'Closed Won', 'Contacted').",
        },
        stageFieldName: {
          type: "string",
          description: "Field API name for stage (defaults to 'Stage' for Deals or 'Lead_Status' for Leads).",
        },
        reasonOrSummary: {
          type: "string",
          description: "Summary of why the client's stage is advancing (recorded in the permanent audit note).",
        },
        additionalFields: {
          type: "object",
          description: "Optional companion fields to update simultaneously (e.g. { Amount: 150000, Closing_Date: '2026-11-15' }).",
        },
        followUpTask: {
          type: "object",
          description: "Optional follow-up task to schedule automatically for the new stage.",
          properties: {
            subject: { type: "string" },
            dueDate: { type: "string", description: "YYYY-MM-DD" },
            priority: {
              type: "string",
              enum: ["High", "Highest", "Normal", "Low", "Lowest"],
            },
            description: { type: "string" },
          },
          required: ["subject", "dueDate"],
        },
      },
      required: ["moduleName", "recordId", "newStage", "reasonOrSummary"],
    },
    handler: async (args) => {
      return crmClient.advanceClientStage(args);
    },
  },
  {
    name: "crm_convert_lead",
    description:
      "Convert a Zoho CRM Lead into a Contact, Account, and optionally create a Deal in a single operation.",
    inputSchema: {
      type: "object",
      properties: {
        leadId: {
          type: "string",
          description: "Zoho CRM Lead ID to convert.",
        },
        createDeal: {
          type: "object",
          description: "Optional Deal to create during Lead conversion.",
          properties: {
            Deal_Name: { type: "string" },
            Stage: { type: "string" },
            Closing_Date: { type: "string", description: "YYYY-MM-DD" },
            Amount: { type: "number" },
          },
          required: ["Deal_Name", "Stage", "Closing_Date"],
        },
      },
      required: ["leadId"],
    },
    handler: async (args) => {
      return crmClient.convertLead(args.leadId, {
        dealData: args.createDeal,
      });
    },
  },
];
