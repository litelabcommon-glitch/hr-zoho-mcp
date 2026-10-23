---
name: zoho-client-lifecycle
description: >-
  Use this skill when the HR user wants to update client progress, swap Deal pipeline stages
  or Lead statuses, convert a Lead to a Deal, or synchronize a client between Zoho CRM and Zoho Books
  for estimates, invoices, and payment tracking.
---

# Zoho Client Lifecycle & CRM ↔ Books Synchronization

This skill prevents the errors caused by manual stage swapping in Zoho CRM and manual re-entry in Zoho Books.

## Standard Procedure

1. **Resolve the Client Record Automatically**:
   - Call `crm_search_records` across `Deals`, `Leads`, `Accounts`, or `Contacts` using `word`, `email`, or `phone`.
   - If the user wants to see full context before acting, call `crm_get_client_full_profile` to view the record, recent HR notes, and attached files.

2. **Inspect Valid Pipeline Stages (When Needed)**:
   - If the exact stage picklist name in Zoho CRM is unknown, call `crm_list_modules_and_fields` with `moduleName: "Deals"` (or `"Leads"` / custom module) to check the valid `pick_list_values` for `Stage` or `Lead_Status`.

3. **Atomic Stage / Progress Swap**:
   - Call `crm_advance_client_stage` with:
     - `moduleName` & `recordId`
     - `newStage`: The exact target stage
     - `reasonOrSummary`: Clear explanation of why the client is advancing
     - `additionalFields`: Any companion fields mentioned by HR (e.g., `Amount`, `Closing_Date`)
     - `followUpTask`: Optional next-step task so nothing slips through the cracks

4. **Simultaneous Zoho Books Sync (Quotes, Retainers & Invoices)**:
   - When a client moves to a commercial stage (e.g., Proposal, Negotiation, Closed Won, Onboarding) or when HR asks for a quote/invoice:
     1. Call `books_sync_crm_client` with the CRM `crmModule` and `crmRecordId` to automatically match or create the Customer Contact in Zoho Books.
     2. Call `books_create_estimate` (for quotes/proposals) or `books_create_invoice` (for retainer/milestone billing) using the returned Zoho Books `contact_id`.
     3. Use `books_get_client_financials` anytime HR asks *"Has Client X paid their invoice?"* or *"What is Client X's outstanding balance?"*
