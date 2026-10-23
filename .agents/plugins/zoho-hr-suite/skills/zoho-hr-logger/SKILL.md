---
name: zoho-hr-logger
description: >-
  Use this skill when the HR user pastes call notes, meeting summaries, WhatsApp chats, emails,
  or voice transcripts and wants to log the conversation, update client details, and schedule follow-ups in Zoho CRM.
---

# HR Conversation Logger & Activity Manager

Turns raw, unstructured HR notes or chat messages into clean Zoho CRM records, Notes, Call logs, and Tasks.

## Standard Procedure

1. **Identify the Client Record**:
   - Search Zoho CRM using `crm_search_records` across `Deals`, `Contacts`, `Leads`, or `Accounts` to locate the client mentioned by HR.

2. **Extract Structured Intelligence from Raw HR Input**:
   - From HR's prompt or pasted text, extract:
     - `channel`: `"Phone Call"`, `"Video Meeting"`, `"WhatsApp / Chat"`, `"Email"`, or `"In-Person"`
     - `subject`: Concise headline of the interaction
     - `summary`: Clean, professional summary of what was discussed
     - `keyDecisionsOrUpdates`: Bullet points of client decisions, budget/scope changes, or candidate feedback
     - `fieldUpdates`: Any CRM fields that changed during the conversation (e.g., phone, email, budget/amount)
     - `followUpTasks`: Concrete next actions with `dueDate` (`YYYY-MM-DD`) and `priority`

3. **Log Everything in One Step**:
   - Call `crm_log_hr_conversation` to simultaneously:
     - Attach a formatted `[HR <Channel>]` Note to the client record
     - Log a completed Call activity in Zoho CRM `Calls` (when applicable)
     - Apply `fieldUpdates` to the CRM record
     - Create linked follow-up Tasks in Zoho CRM `Tasks`
   - If the conversation also changed the client's pipeline stage, call `crm_advance_client_stage` right after.
