import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  HeadingLevel,
  Table,
  TableRow,
  TableCell,
  WidthType,
  BorderStyle,
  AlignmentType,
} from "docx";
import PDFDocument from "pdfkit";
import { authManager } from "../config/auth-manager.js";
import { crmClient } from "../clients/zoho-crm.js";
import { booksClient } from "../clients/zoho-books.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, "..", "..");

export interface DocSection {
  heading: string;
  body?: string;
  bullets?: string[];
}

export interface DocTableData {
  title?: string;
  headers: string[];
  rows: string[][];
}

export interface DocTemplatePreset {
  id: string;
  title: string;
  subtitle?: string;
  description?: string;
  defaultSections: DocSection[];
}

export interface GenerateClientDocInput {
  presetId?: string;
  title?: string;
  subtitle?: string;
  format?: "both" | "docx" | "pdf";
  fileNamePrefix?: string;

  // Optional live Zoho CRM lookup
  crmModule?: string;
  crmRecordId?: string;

  // Client metadata (auto-populated from CRM if crmRecordId is given, or overridden here)
  clientName?: string;
  clientCompany?: string;
  clientEmail?: string;
  clientPhone?: string;
  clientAddress?: string;
  dealAmount?: string | number;
  currency?: string;

  // Dynamic sections (replaces or appends to preset sections)
  sections?: DocSection[];
  appendSectionsToPreset?: boolean;

  // Optional milestone / pricing / deliverables table
  table?: DocTableData;

  // Include signature block at bottom
  includeSignatureBlock?: boolean;
  hrSignatoryName?: string;
  hrSignatoryTitle?: string;

  // Automatic attachment options
  autoAttachToCrm?: boolean;
  autoAttachToBooks?: {
    entityType: "estimates" | "invoices";
    entityId: string;
  };
}

export class DocumentGeneratorService {
  private templatesDir: string;
  private outputDir: string;

  constructor() {
    this.templatesDir = path.join(REPO_ROOT, "templates");
    this.outputDir = path.join(REPO_ROOT, "generated_docs");
    if (!fs.existsSync(this.templatesDir)) {
      fs.mkdirSync(this.templatesDir, { recursive: true });
    }
    if (!fs.existsSync(this.outputDir)) {
      fs.mkdirSync(this.outputDir, { recursive: true });
    }
  }

  public listPresets(): DocTemplatePreset[] {
    if (!fs.existsSync(this.templatesDir)) {
      return [];
    }
    const files = fs.readdirSync(this.templatesDir).filter((f) => f.endsWith(".json"));
    const result: DocTemplatePreset[] = [];
    for (const file of files) {
      try {
        const raw = fs.readFileSync(path.join(this.templatesDir, file), "utf-8");
        result.push(JSON.parse(raw) as DocTemplatePreset);
      } catch {
        // Ignore invalid JSON files
      }
    }
    return result;
  }

  public savePreset(preset: DocTemplatePreset): string {
    const safeId = preset.id.toLowerCase().replace(/[^a-z0-9-_]/g, "-");
    const targetPath = path.join(this.templatesDir, `${safeId}.json`);
    fs.writeFileSync(targetPath, JSON.stringify({ ...preset, id: safeId }, null, 2), "utf-8");
    return targetPath;
  }

  private interpolate(text: string, vars: Record<string, string>): string {
    return text.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_, key) => {
      return vars[key] !== undefined ? vars[key] : `{{${key}}}`;
    });
  }

  public async generateAndAttach(input: GenerateClientDocInput): Promise<{
    generatedFiles: { docxPath?: string; pdfPath?: string };
    crmAttachmentResults: any[];
    booksAttachmentResults: any[];
    crmAuditNote?: any;
    resolvedClient: Record<string, string>;
  }> {
    const cfg = authManager.loadConfig();
    const branding = cfg?.branding || {};

    // 1. If crmModule & crmRecordId are provided, pull live client fields from Zoho CRM
    let crmRecord: Record<string, any> | null = null;
    if (input.crmModule && input.crmRecordId) {
      try {
        crmRecord = await crmClient.getRecord(input.crmModule, input.crmRecordId);
      } catch {
        // Continue with manual fields if lookup fails
      }
    }

    const clientName =
      input.clientName ||
      crmRecord?.Full_Name ||
      crmRecord?.Contact_Name?.name ||
      crmRecord?.Deal_Name ||
      crmRecord?.Account_Name?.name ||
      crmRecord?.Account_Name ||
      crmRecord?.Name ||
      "Valued Client";

    const clientCompany =
      input.clientCompany ||
      crmRecord?.Account_Name?.name ||
      crmRecord?.Account_Name ||
      crmRecord?.Company ||
      clientName;

    const clientEmail = input.clientEmail || crmRecord?.Email || "";
    const clientPhone = input.clientPhone || crmRecord?.Phone || crmRecord?.Mobile || "";
    const clientAddress =
      input.clientAddress ||
      [
        crmRecord?.Billing_Street || crmRecord?.Mailing_Street || crmRecord?.Street,
        crmRecord?.Billing_City || crmRecord?.Mailing_City || crmRecord?.City,
        crmRecord?.Billing_State || crmRecord?.Mailing_State || crmRecord?.State,
        crmRecord?.Billing_Country || crmRecord?.Mailing_Country || crmRecord?.Country,
      ]
        .filter(Boolean)
        .join(", ") ||
      "";

    const dealAmount = String(
      input.dealAmount ?? crmRecord?.Amount ?? crmRecord?.Annual_Revenue ?? "TBD"
    );
    const currency =
      input.currency || crmRecord?.Currency || branding.defaultCurrency || "INR";

    const companyName = branding.companyName || process.env.COMPANY_NAME || "Our Organization";
    const companyAddress = branding.companyAddress || process.env.COMPANY_ADDRESS || "";
    const companyEmail = branding.companyEmail || process.env.COMPANY_EMAIL || "";
    const companyPhone = branding.companyPhone || process.env.COMPANY_PHONE || "";
    const hrSignatoryName =
      input.hrSignatoryName || branding.hrSignatoryName || "Authorized HR Signatory";
    const hrSignatoryTitle =
      input.hrSignatoryTitle || branding.hrSignatoryTitle || "HR & Client Operations";

    const dateStr = new Date().toISOString().slice(0, 10);
    const refNumber = `DOC-${dateStr.replace(/-/g, "")}-${Math.floor(1000 + Math.random() * 9000)}`;

    const vars: Record<string, string> = {
      client_name: String(clientName),
      client_company: String(clientCompany),
      client_email: String(clientEmail),
      client_phone: String(clientPhone),
      client_address: String(clientAddress),
      deal_amount: dealAmount,
      currency: String(currency),
      company_name: companyName,
      date: dateStr,
      ref_number: refNumber,
    };

    // 2. Load preset if specified
    const presets = this.listPresets();
    const matchedPreset = input.presetId
      ? presets.find((p) => p.id === input.presetId)
      : undefined;

    const docTitle = this.interpolate(
      input.title || matchedPreset?.title || "CLIENT DOCUMENTATION & AGREEMENT",
      vars
    );
    const docSubtitle = this.interpolate(
      input.subtitle || matchedPreset?.subtitle || `Prepared for ${clientCompany}`,
      vars
    );

    let rawSections: DocSection[] = [];
    if (matchedPreset && (!input.sections || input.appendSectionsToPreset)) {
      rawSections.push(...matchedPreset.defaultSections);
    }
    if (input.sections && input.sections.length > 0) {
      rawSections.push(...input.sections);
    }
    if (rawSections.length === 0) {
      rawSections = [
        {
          heading: "1. Overview",
          body: `This document sets forth the updated terms and progress details for ${clientCompany} (${clientName}).`,
        },
      ];
    }

    const interpolatedSections: DocSection[] = rawSections.map((s) => ({
      heading: this.interpolate(s.heading, vars),
      body: s.body ? this.interpolate(s.body, vars) : undefined,
      bullets: s.bullets ? s.bullets.map((b) => this.interpolate(b, vars)) : undefined,
    }));

    const safeClientSlug = String(clientCompany)
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 30);
    const prefix = input.fileNamePrefix || input.presetId || "client-doc";
    const baseFileName = `${prefix}-${safeClientSlug || "client"}-${dateStr}`;

    const format = input.format || "both";
    const generatedFiles: { docxPath?: string; pdfPath?: string } = {};

    if (format === "both" || format === "docx") {
      const docxPath = path.join(this.outputDir, `${baseFileName}.docx`);
      await this.buildDocxFile({
        filePath: docxPath,
        docTitle,
        docSubtitle,
        refNumber,
        dateStr,
        companyName,
        companyAddress,
        companyEmail,
        companyPhone,
        clientName: String(clientName),
        clientCompany: String(clientCompany),
        clientEmail: String(clientEmail),
        clientPhone: String(clientPhone),
        clientAddress: String(clientAddress),
        sections: interpolatedSections,
        table: input.table,
        includeSignatureBlock: input.includeSignatureBlock ?? true,
        hrSignatoryName,
        hrSignatoryTitle,
      });
      generatedFiles.docxPath = docxPath;
    }

    if (format === "both" || format === "pdf") {
      const pdfPath = path.join(this.outputDir, `${baseFileName}.pdf`);
      await this.buildPdfFile({
        filePath: pdfPath,
        docTitle,
        docSubtitle,
        refNumber,
        dateStr,
        companyName,
        companyAddress,
        companyEmail,
        companyPhone,
        clientName: String(clientName),
        clientCompany: String(clientCompany),
        clientEmail: String(clientEmail),
        clientPhone: String(clientPhone),
        clientAddress: String(clientAddress),
        sections: interpolatedSections,
        table: input.table,
        includeSignatureBlock: input.includeSignatureBlock ?? true,
        hrSignatoryName,
        hrSignatoryTitle,
      });
      generatedFiles.pdfPath = pdfPath;
    }

    // 3. Auto-attach to Zoho CRM if requested
    const crmAttachmentResults: any[] = [];
    let crmAuditNote: any = undefined;
    if (input.autoAttachToCrm && input.crmModule && input.crmRecordId) {
      const filesToUpload = [generatedFiles.pdfPath, generatedFiles.docxPath].filter(
        Boolean
      ) as string[];
      for (const fPath of filesToUpload) {
        const res = await crmClient.uploadAttachment(
          input.crmModule,
          input.crmRecordId,
          fPath
        );
        crmAttachmentResults.push({ file: path.basename(fPath), result: res });
      }

      crmAuditNote = await crmClient
        .addNote(
          input.crmModule,
          input.crmRecordId,
          `[Document Generated] ${docTitle}`,
          `Generated custom client document (${refNumber}) on ${dateStr}.\nAttached files: ${filesToUpload
            .map((f) => path.basename(f))
            .join(", ")}\nSections included: ${interpolatedSections
            .map((s) => s.heading)
            .join(" | ")}`
        )
        .catch(() => undefined);
    }

    // 4. Auto-attach to Zoho Books if requested
    const booksAttachmentResults: any[] = [];
    if (input.autoAttachToBooks) {
      const fileForBooks = generatedFiles.pdfPath || generatedFiles.docxPath;
      if (fileForBooks) {
        const res = await booksClient.uploadBooksAttachment({
          entityType: input.autoAttachToBooks.entityType,
          entityId: input.autoAttachToBooks.entityId,
          filePath: fileForBooks,
        });
        booksAttachmentResults.push({
          file: path.basename(fileForBooks),
          result: res,
        });
      }
    }

    return {
      generatedFiles,
      crmAttachmentResults,
      booksAttachmentResults,
      crmAuditNote,
      resolvedClient: vars,
    };
  }

  private async buildDocxFile(params: {
    filePath: string;
    docTitle: string;
    docSubtitle: string;
    refNumber: string;
    dateStr: string;
    companyName: string;
    companyAddress: string;
    companyEmail: string;
    companyPhone: string;
    clientName: string;
    clientCompany: string;
    clientEmail: string;
    clientPhone: string;
    clientAddress: string;
    sections: DocSection[];
    table?: DocTableData;
    includeSignatureBlock: boolean;
    hrSignatoryName: string;
    hrSignatoryTitle: string;
  }): Promise<void> {
    const children: Array<Paragraph | Table> = [];

    // Header / Letterhead
    children.push(
      new Paragraph({
        alignment: AlignmentType.RIGHT,
        children: [
          new TextRun({ text: params.companyName, bold: true, size: 24, color: "1E3A8A" }),
        ],
      })
    );

    const companyContactLine = [params.companyAddress, params.companyEmail, params.companyPhone]
      .filter(Boolean)
      .join(" | ");
    if (companyContactLine) {
      children.push(
        new Paragraph({
          alignment: AlignmentType.RIGHT,
          children: [new TextRun({ text: companyContactLine, size: 18, color: "64748B" })],
        })
      );
    }

    children.push(
      new Paragraph({
        spacing: { before: 240, after: 120 },
        children: [
          new TextRun({ text: params.docTitle, bold: true, size: 32, color: "0F172A" }),
        ],
      }),
      new Paragraph({
        spacing: { after: 200 },
        children: [
          new TextRun({ text: params.docSubtitle, italics: true, size: 22, color: "475569" }),
        ],
      }),
      new Paragraph({
        spacing: { after: 240 },
        children: [
          new TextRun({ text: `Reference: ${params.refNumber}   |   Date: ${params.dateStr}`, size: 20, bold: true }),
        ],
      })
    );

    // Client Metadata Summary Box
    children.push(
      new Paragraph({
        spacing: { before: 120, after: 60 },
        children: [new TextRun({ text: "PREPARED FOR:", bold: true, size: 20, color: "1E3A8A" })],
      }),
      new Paragraph({
        children: [
          new TextRun({ text: `Client / Contact: `, bold: true, size: 20 }),
          new TextRun({ text: `${params.clientName} (${params.clientCompany})`, size: 20 }),
        ],
      })
    );

    if (params.clientEmail || params.clientPhone) {
      children.push(
        new Paragraph({
          children: [
            new TextRun({ text: `Contact Details: `, bold: true, size: 20 }),
            new TextRun({
              text: [params.clientEmail, params.clientPhone].filter(Boolean).join(" | "),
              size: 20,
            }),
          ],
        })
      );
    }
    if (params.clientAddress) {
      children.push(
        new Paragraph({
          spacing: { after: 200 },
          children: [
            new TextRun({ text: `Address: `, bold: true, size: 20 }),
            new TextRun({ text: params.clientAddress, size: 20 }),
          ],
        })
      );
    }

    // Document Sections
    for (const sec of params.sections) {
      children.push(
        new Paragraph({
          heading: HeadingLevel.HEADING_2,
          spacing: { before: 280, after: 120 },
          children: [new TextRun({ text: sec.heading, bold: true, size: 24, color: "1E3A8A" })],
        })
      );

      if (sec.body) {
        for (const para of sec.body.split("\n")) {
          children.push(
            new Paragraph({
              spacing: { after: 120 },
              children: [new TextRun({ text: para, size: 21 })],
            })
          );
        }
      }

      if (sec.bullets && sec.bullets.length > 0) {
        for (const bullet of sec.bullets) {
          children.push(
            new Paragraph({
              bullet: { level: 0 },
              spacing: { after: 80 },
              children: [new TextRun({ text: bullet, size: 21 })],
            })
          );
        }
      }
    }

    // Optional Table (Milestones / Pricing / Deliverables)
    if (params.table && params.table.headers.length > 0) {
      if (params.table.title) {
        children.push(
          new Paragraph({
            spacing: { before: 280, after: 120 },
            children: [
              new TextRun({ text: params.table.title, bold: true, size: 24, color: "1E3A8A" }),
            ],
          })
        );
      }

      const headerRow = new TableRow({
        children: params.table.headers.map(
          (h) =>
            new TableCell({
              children: [
                new Paragraph({
                  children: [new TextRun({ text: h, bold: true, size: 20 })],
                }),
              ],
            })
        ),
      });

      const bodyRows = params.table.rows.map(
        (r) =>
          new TableRow({
            children: r.map(
              (cellText) =>
                new TableCell({
                  children: [
                    new Paragraph({
                      children: [new TextRun({ text: String(cellText ?? ""), size: 20 })],
                    }),
                  ],
                })
            ),
          })
      );

      children.push(
        new Table({
          width: { size: 100, type: WidthType.PERCENTAGE },
          borders: {
            top: { style: BorderStyle.SINGLE, size: 1, color: "CBD5E1" },
            bottom: { style: BorderStyle.SINGLE, size: 1, color: "CBD5E1" },
            left: { style: BorderStyle.SINGLE, size: 1, color: "CBD5E1" },
            right: { style: BorderStyle.SINGLE, size: 1, color: "CBD5E1" },
          },
          rows: [headerRow, ...bodyRows],
        })
      );
    }

    // Signature Block
    if (params.includeSignatureBlock) {
      children.push(
        new Paragraph({
          spacing: { before: 480, after: 160 },
          children: [
            new TextRun({
              text: "IN WITNESS WHEREOF, the parties hereto have executed this document as of the date written above.",
              italics: true,
              size: 20,
            }),
          ],
        }),
        new Paragraph({
          spacing: { before: 360 },
          children: [
            new TextRun({
              text: `For ${params.companyName}: ___________________________          For ${params.clientCompany}: ___________________________`,
              size: 20,
              bold: true,
            }),
          ],
        }),
        new Paragraph({
          spacing: { before: 80 },
          children: [
            new TextRun({
              text: `Name: ${params.hrSignatoryName} (${params.hrSignatoryTitle})                    Name: ${params.clientName}`,
              size: 20,
            }),
          ],
        })
      );
    }

    const doc = new Document({
      sections: [{ children }],
    });

    const buffer = await Packer.toBuffer(doc);
    fs.writeFileSync(params.filePath, buffer);
  }

  private async buildPdfFile(params: {
    filePath: string;
    docTitle: string;
    docSubtitle: string;
    refNumber: string;
    dateStr: string;
    companyName: string;
    companyAddress: string;
    companyEmail: string;
    companyPhone: string;
    clientName: string;
    clientCompany: string;
    clientEmail: string;
    clientPhone: string;
    clientAddress: string;
    sections: DocSection[];
    table?: DocTableData;
    includeSignatureBlock: boolean;
    hrSignatoryName: string;
    hrSignatoryTitle: string;
  }): Promise<void> {
    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({ margin: 50, size: "A4" });
      const stream = fs.createWriteStream(params.filePath);
      doc.pipe(stream);

      // Header
      doc
        .fontSize(12)
        .fillColor("#1E3A8A")
        .text(params.companyName, { align: "right" });
      const contactLine = [params.companyAddress, params.companyEmail, params.companyPhone]
        .filter(Boolean)
        .join(" | ");
      if (contactLine) {
        doc.fontSize(9).fillColor("#64748B").text(contactLine, { align: "right" });
      }

      doc.moveDown(1);
      doc.fontSize(18).fillColor("#0F172A").text(params.docTitle, { align: "left" });
      doc.fontSize(11).fillColor("#475569").text(params.docSubtitle);
      doc.moveDown(0.5);
      doc
        .fontSize(10)
        .fillColor("#0F172A")
        .text(`Reference: ${params.refNumber}   |   Date: ${params.dateStr}`);

      doc.moveDown(0.8);
      doc.fontSize(10).fillColor("#1E3A8A").text("PREPARED FOR:");
      doc
        .fontSize(10)
        .fillColor("#0F172A")
        .text(`Client: ${params.clientName} (${params.clientCompany})`);
      if (params.clientEmail || params.clientPhone) {
        doc.text(
          `Contact: ${[params.clientEmail, params.clientPhone].filter(Boolean).join(" | ")}`
        );
      }
      if (params.clientAddress) {
        doc.text(`Address: ${params.clientAddress}`);
      }

      doc.moveDown(1);

      // Sections
      for (const sec of params.sections) {
        doc.fontSize(13).fillColor("#1E3A8A").text(sec.heading);
        doc.moveDown(0.3);
        if (sec.body) {
          doc.fontSize(10.5).fillColor("#1E293B").text(sec.body, { lineGap: 3 });
          doc.moveDown(0.4);
        }
        if (sec.bullets && sec.bullets.length > 0) {
          for (const b of sec.bullets) {
            doc.fontSize(10.5).fillColor("#1E293B").text(`  •  ${b}`, { lineGap: 2 });
          }
          doc.moveDown(0.4);
        }
        doc.moveDown(0.4);
      }

      // Table
      if (params.table && params.table.headers.length > 0) {
        if (params.table.title) {
          doc.fontSize(13).fillColor("#1E3A8A").text(params.table.title);
          doc.moveDown(0.3);
        }
        doc
          .fontSize(10)
          .fillColor("#0F172A")
          .text(params.table.headers.join("   |   "));
        doc
          .strokeColor("#CBD5E1")
          .moveTo(50, doc.y + 2)
          .lineTo(545, doc.y + 2)
          .stroke();
        doc.moveDown(0.4);

        for (const row of params.table.rows) {
          doc.fontSize(10).fillColor("#334155").text(row.join("   |   "));
          doc.moveDown(0.2);
        }
        doc.moveDown(0.8);
      }

      // Signature block
      if (params.includeSignatureBlock) {
        doc.moveDown(1.5);
        doc
          .fontSize(10)
          .fillColor("#475569")
          .text(
            "IN WITNESS WHEREOF, the parties hereto have executed this document as of the date written above."
          );
        doc.moveDown(1.5);
        doc
          .fontSize(10)
          .fillColor("#0F172A")
          .text(`For ${params.companyName}: ___________________________`, { continued: true })
          .text(`          For ${params.clientCompany}: ___________________________`);
        doc.moveDown(0.4);
        doc.text(
          `${params.hrSignatoryName} (${params.hrSignatoryTitle})                                 ${params.clientName}`
        );
      }

      doc.end();
      stream.on("finish", () => resolve());
      stream.on("error", (err) => reject(err));
    });
  }
}

export const docGenerator = new DocumentGeneratorService();
