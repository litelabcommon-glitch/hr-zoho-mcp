import fs from "node:fs";
import { allTools } from "./tools/index.js";
import { docGenerator } from "./services/doc-generator.js";

async function runSelfTest() {
  console.log("=== Running Zoho HR Suite MCP Self-Test ===");

  // 1. Verify tools registry
  console.log(`[1/3] Registered MCP Tools (${allTools.length}):`);
  for (const t of allTools) {
    console.log(`  - ${t.name}`);
  }
  if (allTools.length < 15) {
    throw new Error("Expected at least 15 MCP tools registered");
  }

  // 2. Verify document presets
  const presets = docGenerator.listPresets();
  console.log(`[2/3] Loaded Document Presets (${presets.length}): ${presets.map((p) => p.id).join(", ")}`);
  if (presets.length < 3) {
    throw new Error("Expected at least 3 starter document presets in templates/");
  }

  // 3. Test Dynamic DOCX & PDF Generation
  console.log("[3/3] Testing Dynamic DOCX & PDF Client Document Engine...");
  const docResult = await docGenerator.generateAndAttach({
    presetId: "client-service-agreement",
    clientName: "Ramesh Kumar",
    clientCompany: "Apex Tech Solutions Pvt Ltd",
    clientEmail: "ramesh@apextech.in",
    clientPhone: "+91 98765 43210",
    clientAddress: "12th Floor, Cyber Towers, Bengaluru, KA",
    dealAmount: "4,50,000",
    currency: "INR",
    appendSectionsToPreset: true,
    sections: [
      {
        heading: "5. Special HR Clause (Custom Add-On)",
        body: "Per our HR discussion, a 45-day extended candidate replacement guarantee applies to all senior engineering roles hired under this agreement.",
      },
    ],
    table: {
      title: "Milestone Billing & Payment Schedule",
      headers: ["Milestone", "Deliverable Stage", "Percentage", "Amount (INR)"],
      rows: [
        ["Milestone 1", "Agreement Signing & Role Kickoff", "40%", "1,80,000"],
        ["Milestone 2", "Candidate Shortlist & Final Selection", "30%", "1,35,000"],
        ["Milestone 3", "Candidate Onboarding & Documentation", "30%", "1,35,000"],
      ],
    },
    format: "both",
    autoAttachToCrm: false,
  });

  if (!docResult.generatedFiles.docxPath || !fs.existsSync(docResult.generatedFiles.docxPath)) {
    throw new Error("DOCX file was not generated!");
  }
  if (!docResult.generatedFiles.pdfPath || !fs.existsSync(docResult.generatedFiles.pdfPath)) {
    throw new Error("PDF file was not generated!");
  }

  console.log(`  [✓] Generated DOCX: ${docResult.generatedFiles.docxPath}`);
  console.log(`  [✓] Generated PDF:  ${docResult.generatedFiles.pdfPath}`);

  // Clean up test output files so repo stays clean
  fs.unlinkSync(docResult.generatedFiles.docxPath);
  fs.unlinkSync(docResult.generatedFiles.pdfPath);

  console.log("=== ALL SELF-TESTS PASSED SUCCESSFULLY ===");
}

runSelfTest().catch((err) => {
  console.error("Self-test failed:", err);
  process.exit(1);
});
