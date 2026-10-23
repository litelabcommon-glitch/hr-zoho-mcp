#!/usr/bin/env bash
set -e

echo "========================================================"
echo "  Zoho HR, CRM & Books Autopilot — Laptop Setup"
echo "========================================================"

echo ""
echo "[1/4] Installing dependencies..."
npm install

echo ""
echo "[2/4] Building TypeScript MCP Server..."
npm run build

echo ""
echo "[3/4] Verifying MCP Tools & Document Engine..."
npm test

echo ""
echo "[4/4] Registering Antigravity Plugin & MCP Server..."
node dist/cli-setup.js --non-interactive

echo ""
echo "========================================================"
echo "  SETUP COMPLETE! Ready to use in Antigravity."
echo "========================================================"
echo "Next Step:"
echo "1. Restart or open Antigravity in this folder."
echo "2. In Antigravity chat, simply type: 'Help me link my Zoho account'"
echo "   and paste your Zoho Self-Client ID, Secret, and Grant Token!"
