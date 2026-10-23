import { peopleRecruitClient } from "../clients/zoho-people-recruit.js";
import { ToolDefinition } from "./types.js";

export const customModuleTools: ToolDefinition[] = [
  {
    name: "zoho_recruit_manage",
    description:
      "Search, create, or update records in Zoho Recruit (e.g. Candidates, Job_Openings, Interviews, Clients, Contacts, Applications).",
    inputSchema: {
      type: "object",
      properties: {
        action: {
          type: "string",
          enum: ["search", "create", "update"],
          description: "Operation to perform in Zoho Recruit.",
        },
        moduleName: {
          type: "string",
          description:
            "Zoho Recruit module API name, e.g., 'Candidates', 'Job_Openings', 'Interviews', 'Clients', 'Applications'.",
        },
        word: {
          type: "string",
          description: "Keyword search (used when action='search').",
        },
        criteria: {
          type: "string",
          description: "Search criteria string (used when action='search').",
        },
        recordId: {
          type: "string",
          description: "Record ID (required when action='update').",
        },
        data: {
          type: "object",
          description: "Field key-value payload (used when action='create' or 'update').",
        },
      },
      required: ["action", "moduleName"],
    },
    handler: async (args) => {
      if (args.action === "search") {
        const records = await peopleRecruitClient.searchRecruitRecords({
          moduleName: args.moduleName,
          word: args.word,
          criteria: args.criteria,
        });
        return { count: records.length, records };
      }

      if (!args.data) {
        throw new Error("`data` object is required when action is 'create' or 'update'.");
      }

      return peopleRecruitClient.upsertRecruitRecord({
        moduleName: args.moduleName,
        recordId: args.action === "update" ? args.recordId : undefined,
        data: args.data,
      });
    },
  },
  {
    name: "zoho_people_manage",
    description:
      "List Zoho People forms, search employee/onboarding records, or insert/update a record in a Zoho People form.",
    inputSchema: {
      type: "object",
      properties: {
        action: {
          type: "string",
          enum: ["list_forms", "get_records", "insert_record", "update_record"],
          description: "Operation to perform in Zoho People.",
        },
        formLinkName: {
          type: "string",
          description: "Zoho People form link name (e.g. 'employee', 'onboarding', 'leave').",
        },
        searchColumn: {
          type: "string",
          description: "Optional column name to filter records (e.g. 'EmailID' or 'FirstName').",
        },
        searchValue: {
          type: "string",
          description: "Optional search text for `searchColumn`.",
        },
        recordId: {
          type: "string",
          description: "Record ID (required when action='update_record').",
        },
        inputData: {
          type: "object",
          description: "Field key-value map for inserting or updating a Zoho People record.",
        },
      },
      required: ["action"],
    },
    handler: async (args) => {
      if (args.action === "list_forms") {
        return peopleRecruitClient.getPeopleRecords({});
      }
      if (args.action === "get_records") {
        if (!args.formLinkName) {
          throw new Error("`formLinkName` is required for action='get_records'.");
        }
        return peopleRecruitClient.getPeopleRecords({
          formLinkName: args.formLinkName,
          searchColumn: args.searchColumn,
          searchValue: args.searchValue,
        });
      }
      if (!args.formLinkName || !args.inputData) {
        throw new Error(
          "`formLinkName` and `inputData` are required for inserting or updating a Zoho People record."
        );
      }
      return peopleRecruitClient.upsertPeopleRecord({
        formLinkName: args.formLinkName,
        recordId: args.action === "update_record" ? args.recordId : undefined,
        inputData: args.inputData,
      });
    },
  },
];
