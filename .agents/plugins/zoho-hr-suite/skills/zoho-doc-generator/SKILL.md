---
name: zoho-doc-generator
description: >-
  Use this skill when the HR user wants to generate, customize, modify, or attach client documentation
  such as Service Agreements, Commercial Proposals, Statements of Work (SOW), Candidate Offer Letters,
  or Onboarding Packs without using manual Zoho templates.
---

# Dynamic Client Document Generator (Zero Manual Zoho Templates)

Replaces Zoho's rigid mail-merge templates with on-the-fly `.docx` and `.pdf` generation directly attached to Zoho CRM and Zoho Books.

## Standard Procedure

1. **Find the Client in Zoho CRM**:
   - If HR names a client or deal, call `crm_search_records` to get the `moduleName` (e.g., `Deals`, `Contacts`, `Accounts`) and `recordId`.

2. **Choose or Adapt a Structure**:
   - Available starter presets in `templates/` (viewable via `doc_list_or_save_presets`):
     - `client-service-agreement`: Master Client Service & HR Consulting Agreement
     - `hr-recruitment-proposal`: Commercial Proposal & Statement of Work
     - `candidate-offer-letter`: Offer of Employment / Engagement Letter
   - When HR asks for custom clauses, revised payment milestones, special replacement guarantees, or custom deliverables:
     - Construct tailored `sections` (headings, body paragraphs, bullet lists) and/or a structured `table` (e.g., Milestone Billing Schedule or Fee Breakdown).
     - Set `appendSectionsToPreset: true` to add custom clauses onto a preset, or `appendSectionsToPreset: false` to use your custom `sections` list directly.

3. **Generate DOCX + PDF & Auto-Attach to Zoho**:
   - Call `doc_generate_and_attach` with:
     - `crmModule` and `crmRecordId` (automatically pulls live client name, company, address, email, phone, and deal amount from Zoho CRM!)
     - `format: "both"` (creates both an editable `.docx` Word file and a print-ready `.pdf`)
     - `autoAttachToCrm: true` (automatically uploads both files straight to the client's Zoho CRM **Attachments** related list and logs an audit Note!)
     - `autoAttachToBooks`: Optional `{ entityType: "estimates" | "invoices", entityId: "..." }` if attaching to a Zoho Books Estimate or Invoice.

4. **Save Reusable Variations (Optional)**:
   - If HR says *"Save this new clause structure so we can reuse it for future clients"*, call `doc_list_or_save_presets` with `action: "save"`.
