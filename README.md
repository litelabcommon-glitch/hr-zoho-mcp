# Zoho HR, CRM & Books Autopilot (`zoho-hr-suite`)

A 100% chat-driven **MCP Server + Antigravity Plugin** that allows HR and Client Operations to manage **Zoho CRM**, **Zoho Books**, **Zoho Recruit**, **Zoho People**, and **Dynamic Client Documentation (`.docx` & `.pdf`)** directly by prompting inside Antigravity (or Claude) — with **zero web UI dashboards** and **zero manual Zoho template editing**.

---

## What HR Can Do Simply by Prompting in Antigravity

- **Link Zoho Credentials Directly in Chat**: Paste a Zoho Self-Client `Client ID`, `Client Secret`, and 1-time `Grant Token` into chat. The MCP server exchanges it for a permanent refresh token, auto-discovers the Zoho Books Organization ID, and auto-refreshes tokens forever.
- **Log HR Conversations & Follow-Ups**: Paste raw call notes, WhatsApp chats, or email threads into chat. The agent automatically formats a structured **Zoho CRM Note**, logs a **Call Activity**, updates changed client fields, and schedules follow-up **Tasks**.
- **Safe, Atomic Client Stage Swapping**: Say *"Move Ramesh's deal to Negotiation and set closing date to Nov 15"*. The agent updates the stage, verifies valid picklist values, and automatically attaches a timestamped `[Stage Update]` audit note so client progress is never out of sync.
- **Dynamic Client DOCX & PDF Generation (No More Manual Zoho Templates)**: Say *"Generate a Service Agreement for Apex Tech with a 40/30/30 milestone split and a 45-day candidate replacement clause, and attach it to their Deal"*. The agent pulls live client details from Zoho CRM, builds a formatted `.docx` and `.pdf` locally, and uploads both directly into the client's **Zoho CRM Attachments** (or Zoho Books Estimate/Invoice).
- **Simultaneous Zoho CRM ↔ Zoho Books Sync**: Automatically syncs Zoho CRM clients into Zoho Books Customer Contacts, creates Estimates/Quotes and Invoices, and checks live outstanding balances and payment statuses right from chat.

---

## How to Deploy on the HR Laptop (2-Minute Setup)

### Step 1: Clone & Run the 1-Click Installer
On the HR laptop, open PowerShell (Windows) or Terminal (Mac/Linux):

```powershell
git clone https://github.com/litelabcommon-glitch/hr-zoho-mcp.git
cd hr-zoho-mcp
.\setup.ps1
```
*(On macOS/Linux, run `bash setup.sh`)*

What `setup.ps1` does automatically:
1. Installs dependencies and compiles the TypeScript MCP server (`dist/index.js`).
2. Verifies all 18 MCP tools and tests the DOCX/PDF document generator.
3. Installs and registers the `zoho-hr-suite` plugin and MCP server into Antigravity (`~/.gemini/config/plugins/zoho-hr-suite` and `~/.gemini/config/mcp_config.json`).

---

### Step 2: Link Zoho Keys Inside Antigravity Chat
1. Open the [Zoho API Console](https://api-console.zoho.in/) (use `.in`, `.com`, or `.eu` matching your Zoho account).
2. Click **Add Client** $\rightarrow$ **Self Client** $\rightarrow$ **Create**.
3. Copy your **Client ID** and **Client Secret** from the *Client Secret* tab.
4. Click the **Generate Code** tab and paste these Scopes:
   ```text
   ZohoCRM.modules.ALL,ZohoCRM.settings.ALL,ZohoCRM.org.READ,ZohoCRM.coql.READ,ZohoBooks.fullaccess.all,ZohoRecruit.modules.ALL,ZOHOPEOPLE.forms.ALL
   ```
5. Set Time Duration to **10 minutes**, enter any description, and click **Create** to copy your **Grant Token**.
6. Open **Antigravity** and type in chat:
   > *"Link my Zoho account: Client ID is `1000.xxx`, Client Secret is `yyy`, Grant Token is `1000.zzz`, and our company name is `Your Company Name`."*

That's it! Credentials are saved locally in `~/.zoho-hr-mcp/credentials.json` and will auto-refresh permanently.

---

## Included MCP Tools (18 Tools)

| Category | Tool Name | Purpose |
| :--- | :--- | :--- |
| **Auth & Branding** | `zoho_auth_status` | Check connection status, region, org IDs, and setup instructions |
| | `zoho_auth_configure` | Exchange Self-Client Grant Token and persist auto-refreshing credentials |
| | `zoho_update_company_branding` | Set company letterhead & HR signatory info for generated DOCX/PDFs |
| **Zoho CRM & Pipeline** | `crm_list_modules_and_fields` | Inspect all standard/custom modules and valid pipeline Stage picklists |
| | `crm_search_records` | Search Leads, Contacts, Accounts, Deals, or Custom Modules (Keyword/COQL) |
| | `crm_get_client_full_profile` | Fetch record details + recent HR Notes + uploaded Attachments in one call |
| | `crm_create_or_update_record` | Create or update any standard or custom CRM record |
| | `crm_advance_client_stage` | Atomic stage swapper with mandatory `[Stage Update]` audit note + follow-up task |
| | `crm_convert_lead` | Convert a Lead into Contact + Account + Deal |
| **HR Logs & Tasks** | `crm_log_hr_conversation` | Turn raw HR call/chat notes into structured CRM Notes, Call logs & Tasks |
| | `crm_get_client_notes` | Read chronological HR notes & stage history for a client |
| | `crm_create_followup_task` | Schedule follow-up tasks linked to any client record |
| **Zoho Books** | `books_sync_crm_client` | 1-click sync from Zoho CRM record to Zoho Books Customer Contact |
| | `books_search_contacts` | Search Zoho Books Customers & Vendors |
| | `books_get_client_financials` | View outstanding balances, unused credits, Estimates & Invoices |
| | `books_create_estimate` | Create custom Quotes / Proposals in Zoho Books |
| | `books_create_invoice` | Create Retainer / Milestone Invoices in Zoho Books |
| | `books_record_payment` | Log customer payments against Zoho Books Invoices |
| **Recruit & People** | `zoho_recruit_manage` | Search, create, or update Candidates, Job Openings & Interviews |
| | `zoho_people_manage` | List forms, search records, or add/update onboarding entries in Zoho People |
| **Dynamic Docs** | `doc_generate_and_attach` | Build custom `.docx` and `.pdf` client documents and auto-attach to CRM/Books |
| | `doc_list_or_save_presets` | View or save reusable document structures & clause presets in `templates/` |
| | `crm_upload_file_attachment` | Upload any local file directly to a Zoho CRM record's Attachments |
