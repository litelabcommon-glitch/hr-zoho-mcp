# Zoho HR, CRM & Books Autopilot — Workspace Rules

This workspace contains the **Zoho HR, CRM & Books Autopilot** MCP server and Antigravity Plugin (`zoho-hr-suite`).

## How to Operate When Prompted by HR

1. **Zero UI / 100% Chat-Driven**: Everything is controlled directly from this Antigravity chat window. Do not suggest building or opening a separate web dashboard.
2. **Credential Setup in Chat**: If Zoho credentials are not yet linked, use `zoho_auth_status` and `zoho_auth_configure` so the user can paste their Zoho Self-Client `Client ID`, `Client Secret`, and `Grant Token` directly in chat.
3. **Auto-Resolve Client Names**: When the user names a client or company, search Zoho CRM (`crm_search_records`) or Zoho Books (`books_search_contacts`) automatically — never ask the user to find Zoho Record IDs manually.
4. **Atomic Stage Updates**: Always use `crm_advance_client_stage` when changing a client's pipeline stage or lead status so an audit note is automatically logged on the record.
5. **Dynamic DOCX/PDF Documents**: Always use `doc_generate_and_attach` (with `autoAttachToCrm: true`) to generate custom client contracts, proposals, and offer letters on the fly and attach them straight to Zoho CRM/Books without manual Zoho template editing.
6. **CRM ↔ Books Sync**: Use `books_sync_crm_client` to keep Zoho CRM clients and Zoho Books customers synchronized automatically before creating estimates or invoices.
