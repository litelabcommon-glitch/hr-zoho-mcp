---
name: zoho-setup-wizard
description: >-
  Use this skill when the user wants to link, configure, or troubleshoot their Zoho CRM,
  Zoho Books, or Zoho Recruit/People credentials, or set up company letterhead branding for documents.
---

# Zoho In-Chat Credential Setup Wizard

Guide the user to link their Zoho account directly inside Antigravity chat in less than 2 minutes.

## Workflow

1. **Check Current Status**:
   - Call `zoho_auth_status` with `verifyLiveConnection: true`.
   - If already connected and valid, report the connected Zoho region, CRM Organization name, and Zoho Books Organization ID.

2. **Guide User to Generate a Zoho Self-Client Grant Token (If Not Linked)**:
   - Ask the user to open the Zoho API Console for their region:
     - India: `https://api-console.zoho.in/`
     - US/Global: `https://api-console.zoho.com/`
     - Europe: `https://api-console.zoho.eu/`
   - Click **Add Client** -> Select **Self Client** -> Click **Create**.
   - Under the **Client Secret** tab, copy the **Client ID** and **Client Secret**.
   - Under the **Generate Code** tab, paste this exact Scope string:
     ```text
     ZohoCRM.modules.ALL,ZohoCRM.settings.ALL,ZohoCRM.org.READ,ZohoCRM.coql.READ,ZohoBooks.fullaccess.all,ZohoRecruit.modules.ALL,ZOHOPEOPLE.forms.ALL
     ```
   - Choose **Time Duration: 10 minutes**, type `HR Autopilot` in Description, and click **Create** to copy the **Grant Token**.

3. **Exchange & Persist Credentials**:
   - As soon as the user pastes their `Client ID`, `Client Secret`, and `Grant Token` (or `Refresh Token`) in chat, immediately call `zoho_auth_configure`.
   - Optionally call `zoho_update_company_branding` if the user provides their Company Name, Address, or HR Signatory Name/Title for client agreements.
