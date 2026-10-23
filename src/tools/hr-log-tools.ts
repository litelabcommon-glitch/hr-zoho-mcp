import { crmClient } from "../clients/zoho-crm.js";
import { ToolDefinition } from "./types.js";

export const hrLogTools: ToolDefinition[] = [
  {
    name: "crm_log_hr_conversation",
    description:
      "Log an HR conversation (from Phone Call, Video Meeting, WhatsApp/Chat, Email, or In-Person) directly onto a client's Zoho CRM record. Automatically formats key takeaways into a CRM Note, optionally logs a completed Call activity, updates client record fields, and schedules follow-up Tasks.",
    inputSchema: {
      type: "object",
      properties: {
        moduleName: {
          type: "string",
          description: "Zoho CRM module name ('Leads', 'Contacts', 'Accounts', 'Deals', or custom module).",
        },
        recordId: {
          type: "string",
          description: "Zoho CRM Record ID.",
        },
        channel: {
          type: "string",
          enum: ["Phone Call", "Video Meeting", "WhatsApp / Chat", "Email", "In-Person"],
          description: "Communication channel used by HR.",
        },
        subject: {
          type: "string",
          description: "Short headline of the conversation (e.g. 'Client Onboarding & Milestone Discussion').",
        },
        summary: {
          type: "string",
          description: "Structured summary of the conversation.",
        },
        keyDecisionsOrUpdates: {
          type: "array",
          items: { type: "string" },
          description: "Bullet list of action items, client commitments, or requirement changes.",
        },
        rawTranscriptSnippet: {
          type: "string",
          description: "Optional raw chat/call notes excerpt for archival.",
        },
        logAsCallActivity: {
          type: "boolean",
          description: "Whether to also create an entry in Zoho CRM Calls module.",
        },
        callDurationMinutes: {
          type: "number",
          description: "Duration of the call in minutes (default 15).",
        },
        fieldUpdates: {
          type: "object",
          description: "Optional CRM record fields to update based on the conversation.",
        },
        followUpTasks: {
          type: "array",
          description: "Optional follow-up tasks to assign in Zoho CRM Tasks.",
          items: {
            type: "object",
            properties: {
              subject: { type: "string" },
              dueDate: { type: "string", description: "YYYY-MM-DD" },
              priority: {
                type: "string",
                enum: ["High", "Highest", "Normal", "Low", "Lowest"],
              },
            },
            required: ["subject", "dueDate"],
          },
        },
      },
      required: ["moduleName", "recordId", "channel", "subject", "summary"],
    },
    handler: async (args) => {
      return crmClient.logHrConversation(args);
    },
  },
  {
    name: "crm_get_client_notes",
    description:
      "Retrieve the chronological history of HR Notes, conversation logs, and stage transition audits attached to a Zoho CRM client record.",
    inputSchema: {
      type: "object",
      properties: {
        moduleName: {
          type: "string",
          description: "Zoho CRM module ('Leads', 'Contacts', 'Accounts', 'Deals').",
        },
        recordId: {
          type: "string",
          description: "Zoho CRM Record ID.",
        },
        perPage: {
          type: "number",
          description: "Number of recent notes to retrieve (default 20).",
        },
      },
      required: ["moduleName", "recordId"],
    },
    handler: async (args) => {
      const notes = await crmClient.getNotes(args.moduleName, args.recordId, args.perPage || 20);
      return {
        moduleName: args.moduleName,
        recordId: args.recordId,
        count: notes.length,
        notes,
      };
    },
  },
  {
    name: "crm_create_followup_task",
    description:
      "Create a follow-up Task in Zoho CRM linked to a Lead, Contact, Account, or Deal.",
    inputSchema: {
      type: "object",
      properties: {
        subject: { type: "string", description: "Task title" },
        dueDate: { type: "string", description: "Due date in YYYY-MM-DD format" },
        priority: {
          type: "string",
          enum: ["High", "Highest", "Normal", "Low", "Lowest"],
        },
        status: {
          type: "string",
          enum: ["Not Started", "Deferred", "In Progress", "Completed", "Waiting for input"],
        },
        description: { type: "string" },
        relatedModule: {
          type: "string",
          description: "e.g. 'Deals', 'Contacts', 'Accounts', 'Leads'",
        },
        relatedRecordId: {
          type: "string",
          description: "Zoho CRM Record ID to link the task to.",
        },
      },
      required: ["subject", "dueDate"],
    },
    handler: async (args) => {
      return crmClient.createTask(args);
    },
  },
];
