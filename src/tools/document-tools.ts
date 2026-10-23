import { docGenerator } from "../services/doc-generator.js";
import { crmClient } from "../clients/zoho-crm.js";
import { ToolDefinition } from "./types.js";

export const documentTools: ToolDefinition[] = [
  {
    name: "doc_generate_and_attach",
    description:
      "Dynamic Client Document Engine: Replaces manual Zoho template editing! Dynamically generates custom, formatted Word (.docx) and PDF (.pdf) documents (Agreements, Proposals, SOWs, Offer Letters, Onboarding Packs) populated with live Zoho CRM client data, custom sections/clauses, milestone tables, and signature blocks — and automatically attaches them to the client's Zoho CRM record and/or Zoho Books Estimate/Invoice.",
    inputSchema: {
      type: "object",
      properties: {
        presetId: {
          type: "string",
          description:
            "Optional base preset ID from `templates/` (e.g. 'client-service-agreement', 'hr-recruitment-proposal', 'candidate-offer-letter').",
        },
        title: {
          type: "string",
          description: "Document main heading (e.g. 'MASTER CLIENT SERVICE AGREEMENT').",
        },
        subtitle: {
          type: "string",
          description: "Document subtitle.",
        },
        format: {
          type: "string",
          enum: ["both", "docx", "pdf"],
          description: "Generate both DOCX & PDF (default: 'both'), or only one.",
        },
        fileNamePrefix: {
          type: "string",
          description: "Optional file name prefix (e.g. 'service-agreement').",
        },
        crmModule: {
          type: "string",
          description:
            "Optional Zoho CRM module ('Deals', 'Contacts', 'Accounts', 'Leads') to automatically pull client details from and/or attach generated files to.",
        },
        crmRecordId: {
          type: "string",
          description: "Optional Zoho CRM Record ID.",
        },
        clientName: { type: "string", description: "Client contact name (overrides CRM lookup if provided)." },
        clientCompany: { type: "string", description: "Client company name." },
        clientEmail: { type: "string" },
        clientPhone: { type: "string" },
        clientAddress: { type: "string" },
        dealAmount: { type: "string", description: "Total contract or deal value." },
        currency: { type: "string", description: "Currency code or symbol (e.g. INR, USD)." },
        sections: {
          type: "array",
          description:
            "Custom document sections/clauses. Supports {{client_name}}, {{client_company}}, {{deal_amount}}, {{currency}}, {{date}} placeholders.",
          items: {
            type: "object",
            properties: {
              heading: { type: "string" },
              body: { type: "string" },
              bullets: {
                type: "array",
                items: { type: "string" },
              },
            },
            required: ["heading"],
          },
        },
        appendSectionsToPreset: {
          type: "boolean",
          description:
            "If true and `presetId` is set, appends `sections` after the preset's default sections instead of replacing them.",
        },
        table: {
          type: "object",
          description: "Optional structured table (e.g., Milestone Payment Schedule, Deliverables, or Compensation Breakdown).",
          properties: {
            title: { type: "string" },
            headers: {
              type: "array",
              items: { type: "string" },
            },
            rows: {
              type: "array",
              items: {
                type: "array",
                items: { type: "string" },
              },
            },
          },
          required: ["headers", "rows"],
        },
        includeSignatureBlock: {
          type: "boolean",
          description: "Include dual-party signature block at the bottom (default true).",
        },
        autoAttachToCrm: {
          type: "boolean",
          description:
            "If true (and `crmModule` + `crmRecordId` are provided), automatically uploads the generated DOCX/PDF to the Zoho CRM record's Attachments and logs an audit Note.",
        },
        autoAttachToBooks: {
          type: "object",
          description: "Optional: Automatically upload the generated PDF/DOCX to a Zoho Books Estimate or Invoice.",
          properties: {
            entityType: { type: "string", enum: ["estimates", "invoices"] },
            entityId: { type: "string" },
          },
          required: ["entityType", "entityId"],
        },
      },
    },
    handler: async (args) => {
      return docGenerator.generateAndAttach(args);
    },
  },
  {
    name: "doc_list_or_save_presets",
    description:
      "List all available reusable document presets/snippets in `templates/`, or save a new reusable document preset so HR can generate variations anytime without Zoho templates.",
    inputSchema: {
      type: "object",
      properties: {
        action: {
          type: "string",
          enum: ["list", "save"],
          description: "'list' to view existing presets, or 'save' to create/update a preset.",
        },
        preset: {
          type: "object",
          description: "Required when action='save'.",
          properties: {
            id: { type: "string", description: "Unique slug ID, e.g. 'executive-search-retainer'" },
            title: { type: "string" },
            subtitle: { type: "string" },
            description: { type: "string" },
            defaultSections: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  heading: { type: "string" },
                  body: { type: "string" },
                  bullets: { type: "array", items: { type: "string" } },
                },
                required: ["heading"],
              },
            },
          },
          required: ["id", "title", "defaultSections"],
        },
      },
      required: ["action"],
    },
    handler: async (args) => {
      if (args.action === "list") {
        const presets = docGenerator.listPresets();
        return { count: presets.length, presets };
      }
      if (!args.preset) {
        throw new Error("`preset` object is required when action='save'.");
      }
      const savedPath = docGenerator.savePreset(args.preset);
      return {
        success: true,
        savedPath,
        preset: args.preset,
      };
    },
  },
  {
    name: "crm_upload_file_attachment",
    description:
      "Upload any local file (.docx, .pdf, .xlsx, .png) directly to a Zoho CRM record's Attachments.",
    inputSchema: {
      type: "object",
      properties: {
        moduleName: {
          type: "string",
          description: "Zoho CRM module ('Deals', 'Contacts', 'Accounts', 'Leads', or custom module).",
        },
        recordId: {
          type: "string",
          description: "Zoho CRM Record ID.",
        },
        filePath: {
          type: "string",
          description: "Absolute local file path to upload.",
        },
      },
      required: ["moduleName", "recordId", "filePath"],
    },
    handler: async (args) => {
      return crmClient.uploadAttachment(args.moduleName, args.recordId, args.filePath);
    },
  },
];
