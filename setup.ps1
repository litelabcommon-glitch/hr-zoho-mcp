# ==============================================================================
# Zoho HR, CRM & Books Autopilot — 1-Click Windows Laptop Setup (setup.ps1)
# ==============================================================================
$ErrorActionPreference = "Stop"

Write-Host "========================================================" -ForegroundColor Cyan
Write-Host "  Zoho HR, CRM & Books Autopilot — Laptop Setup" -ForegroundColor Cyan
Write-Host "========================================================" -ForegroundColor Cyan

# 1. Install npm packages
Write-Host "`n[1/4] Installing dependencies..." -ForegroundColor Yellow
npm install

# 2. Build TypeScript MCP Server
Write-Host "`n[2/4] Building TypeScript MCP Server..." -ForegroundColor Yellow
npm run build

# 3. Run Self-Test (Verifies MCP tools + Dynamic DOCX/PDF Generator)
Write-Host "`n[3/4] Verifying MCP Tools & Document Engine..." -ForegroundColor Yellow
npm test

# 4. Register Antigravity Plugin & MCP Config
Write-Host "`n[4/4] Registering Antigravity Plugin & MCP Server..." -ForegroundColor Yellow
node dist/cli-setup.js --non-interactive

Write-Host "`n========================================================" -ForegroundColor Green
Write-Host "  SETUP COMPLETE! Ready to use in Antigravity." -ForegroundColor Green
Write-Host "========================================================" -ForegroundColor Green
Write-Host "Next Step:"
Write-Host "1. Restart or open Antigravity in this folder."
Write-Host "2. In Antigravity chat, simply type: 'Help me link my Zoho account'"
Write-Host "   and paste your Zoho Self-Client ID, Secret, and Grant Token!"
