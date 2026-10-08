#!/usr/bin/env node
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import puppeteer from 'puppeteer-core';
import { z } from 'zod';
import fs from 'fs';
import path from 'path';

// Automatically detect available Chromium/Edge/Chrome executable on Windows/Linux/macOS
function getBrowserExecutablePath() {
  const candidatePaths = [
    'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
    'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
    '/usr/bin/google-chrome',
    '/usr/bin/chromium-browser',
    '/usr/bin/microsoft-edge',
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
    process.env.EDGE_PATH,
    process.env.CHROME_PATH,
    process.env.PUPPETEER_EXECUTABLE_PATH
  ].filter(Boolean);

  for (const p of candidatePaths) {
    if (fs.existsSync(p)) return p;
  }
  return candidatePaths[0] || 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
}

// Convert image file to self-contained Base64 data URL
function getBase64Image(filePath) {
  if (!filePath || !fs.existsSync(filePath)) return '';
  const fileBuffer = fs.readFileSync(filePath);
  const ext = path.extname(filePath).toLowerCase().replace('.', '');
  let mime = 'image/png';
  if (ext === 'jpg' || ext === 'jpeg') mime = 'image/jpeg';
  else if (ext === 'svg') mime = 'image/svg+xml';
  else if (ext === 'webp') mime = 'image/webp';
  return `data:${mime};base64,${fileBuffer.toString('base64')}`;
}

function escapeHTML(str) {
  if (!str) return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

const server = new McpServer({
  name: 'report-craft',
  version: '1.0.0'
});

// Tool 1: capture_screenshots
server.tool(
  'capture_screenshots',
  'Captures high-resolution webpage or application screenshots using headless Edge/Chrome.',
  {
    targets: z.array(z.object({
      url: z.string().describe('URL to navigate to (e.g. http://localhost:5173/dashboard)'),
      outputFileName: z.string().describe('Output PNG file name (e.g. dashboard.png)'),
      fullPage: z.boolean().optional().default(true).describe('Whether to capture full page or standard viewport'),
      delayMs: z.number().optional().default(500).describe('Wait time in milliseconds after navigation before capture'),
      selector: z.string().optional().describe('Optional CSS selector to clip screenshot to')
    })).describe('List of pages/views to screenshot'),
    outputDir: z.string().describe('Directory where screenshots will be saved'),
    viewport: z.object({
      width: z.number().default(1280),
      height: z.number().default(800)
    }).optional()
  },
  async ({ targets, outputDir, viewport }) => {
    try {
      if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
      }

      const execPath = getBrowserExecutablePath();
      const browser = await puppeteer.launch({
        executablePath: execPath,
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
      });

      const page = await browser.newPage();
      const vp = viewport || { width: 1280, height: 800 };
      await page.setViewport(vp);

      const savedFiles = [];
      for (const target of targets) {
        await page.goto(target.url, { waitUntil: 'networkidle0', timeout: 30000 });
        if (target.delayMs && target.delayMs > 0) {
          await new Promise(r => setTimeout(r, target.delayMs));
        }

        const outPath = path.join(outputDir, target.outputFileName);
        if (target.selector) {
          const el = await page.$(target.selector);
          if (el) {
            await el.screenshot({ path: outPath });
          } else {
            await page.screenshot({ path: outPath, fullPage: target.fullPage ?? true });
          }
        } else {
          await page.screenshot({ path: outPath, fullPage: target.fullPage ?? true });
        }
        savedFiles.push({ target: target.url, file: outPath });
      }

      await browser.close();

      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            status: 'success',
            capturedCount: savedFiles.length,
            files: savedFiles
          }, null, 2)
        }]
      };
    } catch (err) {
      return {
        isError: true,
        content: [{ type: 'text', text: `Screenshot capture failed: ${err.message}` }]
      };
    }
  }
);

// Tool 2: collect_source_files
server.tool(
  'collect_source_files',
  'Scans a project directory and extracts source code files formatted for report inclusion.',
  {
    baseDir: z.string().describe('Root directory of the project'),
    relativePaths: z.array(z.string()).optional().describe('Specific relative file paths to extract (e.g. ["src/App.jsx", "src/Header.jsx"])'),
    extensions: z.array(z.string()).optional().default(['.jsx', '.js', '.tsx', '.ts', '.py', '.css', '.scss', '.html', '.ejs', '.json']).describe('Extensions to include if scanning directory'),
    maxFiles: z.number().optional().default(25).describe('Max files to return')
  },
  async ({ baseDir, relativePaths, extensions, maxFiles }) => {
    try {
      const filesToRead = [];

      if (relativePaths && relativePaths.length > 0) {
        for (const rel of relativePaths) {
          const full = path.isAbsolute(rel) ? rel : path.join(baseDir, rel);
          if (fs.existsSync(full) && fs.statSync(full).isFile()) {
            filesToRead.push({
              relativePath: path.relative(baseDir, full).replace(/\\/g, '/'),
              fullPath: full
            });
          }
        }
      } else {
        function walk(dir) {
          if (filesToRead.length >= maxFiles) return;
          const items = fs.readdirSync(dir);
          for (const item of items) {
            if (['node_modules', '.git', 'dist', 'build', '__pycache__', '.next', '.vite'].includes(item)) continue;
            const full = path.join(dir, item);
            const stat = fs.statSync(full);
            if (stat.isDirectory()) {
              walk(full);
            } else if (stat.isFile()) {
              const ext = path.extname(item).toLowerCase();
              if (extensions.includes(ext) && stat.size < 100000) {
                filesToRead.push({
                  relativePath: path.relative(baseDir, full).replace(/\\/g, '/'),
                  fullPath: full
                });
                if (filesToRead.length >= maxFiles) break;
              }
            }
          }
        }
        walk(baseDir);
      }

      const results = filesToRead.map(f => {
        const content = fs.readFileSync(f.fullPath, 'utf-8');
        const lines = content.split(/\r?\n/).length;
        return {
          relativePath: f.relativePath,
          lineCount: lines,
          content: content
        };
      });

      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            status: 'success',
            fileCount: results.length,
            files: results
          }, null, 2)
        }]
      };
    } catch (err) {
      return {
        isError: true,
        content: [{ type: 'text', text: `Failed to collect source files: ${err.message}` }]
      };
    }
  }
);

// Helper for CSS stylesheets based on preset
function getReportCSS(preset) {
  if (preset === 'modern_clean') {
    return `
      @page {
        size: A4;
        margin: 20mm 15mm 20mm 15mm;
      }
      body {
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
        font-size: 11pt;
        color: #1e293b;
        background-color: #ffffff;
        line-height: 1.6;
        margin: 0;
        padding: 0;
      }
      h1, h2, h3 {
        color: #0f172a;
        font-weight: 700;
        margin-top: 1.5em;
        margin-bottom: 0.5em;
      }
      h1 {
        font-size: 18pt;
        text-align: center;
        letter-spacing: -0.5px;
        color: #1e3a8a;
      }
      .subtitle {
        text-align: center;
        color: #64748b;
        font-size: 12pt;
        margin-bottom: 25px;
        font-weight: 500;
      }
      h2 {
        font-size: 13pt;
        border-bottom: 2px solid #e2e8f0;
        padding-bottom: 6px;
        color: #1e40af;
      }
      p, li {
        font-size: 11pt;
        text-align: justify;
        margin-bottom: 10px;
      }
      ul, ol {
        margin-bottom: 20px;
        padding-left: 20px;
      }
      pre {
        font-family: 'JetBrains Mono', 'Fira Code', Consolas, monospace;
        font-size: 9.5pt;
        color: #0f172a;
        background: #f8fafc;
        border: 1px solid #e2e8f0;
        border-radius: 6px;
        padding: 12px 14px;
        margin: 10px 0 25px 0;
        white-space: pre-wrap;
        word-wrap: break-word;
        line-height: 1.45;
      }
      .code-title {
        font-family: monospace;
        font-weight: 600;
        font-size: 10pt;
        color: #334155;
        margin-top: 20px;
        margin-bottom: 4px;
      }
      .image-container {
        margin: 30px 0;
        text-align: center;
        page-break-inside: avoid;
      }
      .image-container img {
        width: 100%;
        max-height: 750px;
        object-fit: contain;
        border: 1px solid #cbd5e1;
        border-radius: 6px;
        margin-top: 8px;
        margin-bottom: 8px;
        display: block;
      }
      .image-caption {
        font-size: 10pt;
        font-weight: 600;
        color: #475569;
        margin-top: 6px;
      }
    `;
  }

  if (preset === 'ieee_style') {
    return `
      @page {
        size: A4;
        margin: 20mm 15mm 20mm 15mm;
      }
      body {
        font-family: 'Times New Roman', Times, serif;
        font-size: 11pt;
        color: #000000;
        line-height: 1.5;
        margin: 0;
        padding: 0;
      }
      h1 {
        font-size: 16pt;
        text-align: center;
        font-weight: bold;
        margin-bottom: 8px;
      }
      .subtitle {
        text-align: center;
        font-style: italic;
        margin-bottom: 25px;
      }
      h2 {
        font-size: 12pt;
        text-transform: uppercase;
        border-bottom: 1px solid #000;
        padding-bottom: 2px;
        margin-top: 25px;
      }
      p, li {
        font-size: 11pt;
        text-align: justify;
      }
      pre {
        font-family: 'Courier New', monospace;
        font-size: 9.5pt;
        background: #fdfdfd;
        border: 1px dashed #666;
        padding: 8px;
        white-space: pre-wrap;
      }
      .code-title {
        font-weight: bold;
        font-size: 10pt;
        margin-top: 15px;
      }
      .image-container {
        margin: 25px 0;
        text-align: center;
        page-break-inside: avoid;
      }
      .image-container img {
        width: 100%;
        border: 1px solid #000;
      }
      .image-caption {
        font-size: 10pt;
        font-style: italic;
        margin-top: 6px;
      }
    `;
  }

  // Default: academic_formal (College & Thesis Standard)
  return `
    @page {
      size: A4;
      margin-top: 2.5cm;
      margin-bottom: 2.2cm;
      margin-left: 1.5cm;
      margin-right: 1.5cm;
    }
    body {
      font-family: 'Times New Roman', Times, serif;
      font-size: 12pt;
      color: #000000;
      background-color: #ffffff;
      line-height: 1.6;
      margin: 0;
      padding: 0;
    }
    h1, h2, h3 {
      font-family: 'Times New Roman', Times, serif;
      color: #000000;
      margin-top: 1.5em;
      margin-bottom: 0.75em;
      font-weight: bold;
    }
    h1 {
      font-size: 16pt;
      text-align: center;
      text-transform: uppercase;
      text-decoration: underline;
      margin-top: 0.5em;
    }
    .subtitle {
      text-align: center;
      font-weight: bold;
      margin-bottom: 35px;
      text-transform: uppercase;
    }
    h2 {
      font-size: 14pt;
      border-bottom: 1px solid #000000;
      padding-bottom: 4px;
      margin-top: 2em;
    }
    p, li {
      font-size: 12pt;
      text-align: justify;
      margin-bottom: 12px;
    }
    ul, ol {
      margin-bottom: 25px;
      padding-left: 25px;
    }
    li {
      margin-bottom: 8px;
    }
    pre {
      font-family: 'Courier New', Courier, monospace;
      font-size: 10pt;
      color: #000000;
      background: transparent;
      border: none;
      padding: 0;
      margin: 10px 0 30px 0;
      white-space: pre-wrap;
      word-wrap: break-word;
      line-height: 1.45;
    }
    .code-title {
      font-weight: bold;
      font-size: 11pt;
      margin-top: 25px;
      margin-bottom: 5px;
    }
    .image-container {
      margin: 35px 0;
      text-align: center;
      page-break-inside: avoid;
    }
    .image-container img {
      width: 100%;
      border: 1px solid #000000;
      margin-top: 10px;
      margin-bottom: 10px;
      display: block;
    }
    .image-caption {
      font-size: 11pt;
      font-weight: bold;
      margin-top: 8px;
      margin-bottom: 15px;
      text-align: center;
    }
  `;
}

// Tool 3: generate_report_html
server.tool(
  'generate_report_html',
  'Generates a fully self-contained HTML report with embedded Base64 images and academic styling.',
  {
    title: z.string().describe('Main document title (e.g. PRACTICAL ASSIGNMENT REPORT)'),
    subtitle: z.string().optional().describe('Subtitle or Topic (e.g. COLLEGE MANAGEMENT SYSTEM USING REACT)'),
    stylePreset: z.enum(['academic_formal', 'modern_clean', 'ieee_style']).default('academic_formal').describe('Formatting style'),
    sections: z.array(z.object({
      heading: z.string().describe('Section title (e.g. 1. OBJECTIVE / AIM)'),
      paragraphs: z.array(z.string()).optional(),
      bulletPoints: z.array(z.string()).optional(),
      numberedPoints: z.array(z.string()).optional()
    })).describe('Content sections'),
    codeListings: z.array(z.object({
      filename: z.string().describe('File path/name (e.g. src/App.jsx)'),
      code: z.string().describe('Raw source code')
    })).optional().default([]),
    figures: z.array(z.object({
      imagePath: z.string().describe('Path to image file (PNG/JPG)'),
      caption: z.string().describe('Figure caption (e.g. Figure 1: Dashboard View)')
    })).optional().default([]),
    outputPath: z.string().optional().describe('Path to save the generated HTML file')
  },
  async ({ title, subtitle, stylePreset, sections, codeListings, figures, outputPath }) => {
    try {
      const css = getReportCSS(stylePreset);

      let sectionsHtml = '';
      for (const sec of sections) {
        sectionsHtml += `\n<h2>${escapeHTML(sec.heading)}</h2>`;
        if (sec.paragraphs) {
          for (const p of sec.paragraphs) {
            sectionsHtml += `\n<p>${p}</p>`;
          }
        }
        if (sec.bulletPoints && sec.bulletPoints.length > 0) {
          sectionsHtml += '\n<ul>';
          for (const bp of sec.bulletPoints) {
            sectionsHtml += `\n  <li>${bp}</li>`;
          }
          sectionsHtml += '\n</ul>';
        }
        if (sec.numberedPoints && sec.numberedPoints.length > 0) {
          sectionsHtml += '\n<ol>';
          for (const np of sec.numberedPoints) {
            sectionsHtml += `\n  <li>${np}</li>`;
          }
          sectionsHtml += '\n</ol>';
        }
      }

      let codeHtml = '';
      if (codeListings && codeListings.length > 0) {
        codeHtml += '\n<h2>SOURCE CODE LISTINGS</h2>';
        for (const item of codeListings) {
          codeHtml += `
            <div class="code-title">File: ${escapeHTML(item.filename)}</div>
            <pre>${escapeHTML(item.code)}</pre>
          `;
        }
      }

      let figuresHtml = '';
      if (figures && figures.length > 0) {
        figuresHtml += '\n<h2>OUTPUT SCREENSHOTS & RESULTS</h2>';
        for (const fig of figures) {
          const b64 = getBase64Image(fig.imagePath);
          figuresHtml += `
            <div class="image-container">
              <div class="image-caption">${escapeHTML(fig.caption)}</div>
              <img src="${b64}" alt="${escapeHTML(fig.caption)}" />
            </div>
          `;
        }
      }

      const fullHtml = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>${escapeHTML(title)}</title>
  <style>
${css}
  </style>
</head>
<body>
  <h1>${escapeHTML(title)}</h1>
  ${subtitle ? `<p class="subtitle">${escapeHTML(subtitle)}</p>` : ''}

${sectionsHtml}
${codeHtml}
${figuresHtml}
</body>
</html>`;

      if (outputPath) {
        const dir = path.dirname(outputPath);
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        fs.writeFileSync(outputPath, fullHtml, 'utf-8');
      }

      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            status: 'success',
            outputPath: outputPath || 'returned_in_memory',
            htmlLength: fullHtml.length
          }, null, 2)
        }]
      };
    } catch (err) {
      return {
        isError: true,
        content: [{ type: 'text', text: `HTML report generation failed: ${err.message}` }]
      };
    }
  }
);

// Tool 4: compile_report_pdf
server.tool(
  'compile_report_pdf',
  'Compiles an HTML report file into academic PDF(s) with institutional header/footer templates and multi-student batching.',
  {
    htmlPath: z.string().describe('Path to source HTML file'),
    outputPdfPath: z.string().describe('Default output PDF destination'),
    subject: z.string().default('Advanced Web Technology').describe('Subject / Course name for footer'),
    logoPath: z.string().optional().describe('Path to University/Institution logo for footer'),
    students: z.array(z.object({
      name: z.string().describe('Student Name'),
      enrollment: z.string().describe('Enrollment / PRN No'),
      batch: z.string().optional().default('5A - B').describe('Class/Batch'),
      outputPdfFileName: z.string().optional().describe('Individual PDF file name if different')
    })).optional().describe('Optional list of students for multi-student batch generation')
  },
  async ({ htmlPath, outputPdfPath, subject, logoPath, students }) => {
    try {
      if (!fs.existsSync(htmlPath)) {
        throw new Error(`HTML file not found at ${htmlPath}`);
      }

      const htmlContent = fs.readFileSync(htmlPath, 'utf-8');
      const logoB64 = logoPath ? getBase64Image(logoPath) : '';
      const execPath = getBrowserExecutablePath();

      const browser = await puppeteer.launch({
        executablePath: execPath,
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
      });

      const studentList = students && students.length > 0 ? students : [
        { name: 'Student', enrollment: 'ENROLLMENT_NO', batch: 'Batch A', outputPdfFileName: path.basename(outputPdfPath) }
      ];

      const outDir = path.dirname(outputPdfPath);
      if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

      const generatedPdfs = [];

      for (const student of studentList) {
        const page = await browser.newPage();
        await page.setContent(htmlContent, { waitUntil: 'load' });

        const targetFileName = student.outputPdfFileName || path.basename(outputPdfPath);
        const targetPath = path.join(outDir, targetFileName);

        const headerHtml = `
          <div style="font-family: 'Times New Roman', Times, serif; font-size: 10pt; color: #000000; width: 100%; text-align: center; font-weight: bold; border-bottom: 1px solid #000000; padding-bottom: 4px; margin: 0 1.5cm;">
            Name: ${student.name} &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; Enrollment No: ${student.enrollment} &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; Class/Batch: ${student.batch || ''}
          </div>
        `;

        const footerHtml = `
          <div style="font-family: 'Times New Roman', Times, serif; font-size: 10pt; color: #000000; width: 100%; display: flex; justify-content: space-between; align-items: center; border-top: 1px solid #000000; padding-top: 4px; margin: 0 1.5cm;">
            <div style="text-align: left; font-weight: bold;">
              Subject: ${subject}
            </div>
            <div style="text-align: right;">
              ${logoB64 ? `<img src="${logoB64}" style="height: 26px; max-width: 100px; object-fit: contain;" alt="Logo" />` : ''}
            </div>
          </div>
        `;

        await page.pdf({
          path: targetPath,
          format: 'A4',
          printBackground: true,
          displayHeaderFooter: true,
          headerTemplate: headerHtml,
          footerTemplate: footerHtml,
          margin: {
            top: '22mm',
            bottom: '22mm',
            left: '15mm',
            right: '15mm'
          }
        });

        await page.close();
        generatedPdfs.push({ student: student.name, enrollment: student.enrollment, path: targetPath });
      }

      await browser.close();

      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            status: 'success',
            count: generatedPdfs.length,
            reports: generatedPdfs
          }, null, 2)
        }]
      };
    } catch (err) {
      return {
        isError: true,
        content: [{ type: 'text', text: `PDF generation failed: ${err.message}` }]
      };
    }
  }
);

// Tool 5: build_complete_assignment_report (End-to-End Orchestrator)
server.tool(
  'build_complete_assignment_report',
  'End-to-end assignment report builder: collects code, embeds screenshots, applies academic styling, and outputs HTML & PDF reports.',
  {
    projectDir: z.string().describe('Directory of the project/assignment'),
    title: z.string().describe('Assignment Title'),
    subtitle: z.string().optional().describe('Subtitle or Topic name'),
    subject: z.string().default('Advanced Web Technology').describe('Subject Name'),
    stylePreset: z.enum(['academic_formal', 'modern_clean', 'ieee_style']).default('academic_formal').describe('Style preset'),
    objective: z.string().describe('Aim or Objective statement'),
    procedureSteps: z.array(z.string()).optional().describe('Steps or procedure points'),
    sourceFilePaths: z.array(z.string()).optional().describe('Relative paths to source files to include in report'),
    screenshots: z.array(z.object({
      imagePath: z.string().describe('Path to existing or captured screenshot'),
      caption: z.string().describe('Caption for the screenshot')
    })).optional().default([]),
    students: z.array(z.object({
      name: z.string(),
      enrollment: z.string(),
      batch: z.string().optional().default('5A - B'),
      outputPdfFileName: z.string().optional()
    })).optional().describe('Student information for header/footer'),
    logoPath: z.string().optional().describe('Path to institutional logo image')
  },
  async (args) => {
    try {
      // 1. Gather code
      const codeListings = [];
      if (args.sourceFilePaths && args.sourceFilePaths.length > 0) {
        for (const rel of args.sourceFilePaths) {
          const full = path.isAbsolute(rel) ? rel : path.join(args.projectDir, rel);
          if (fs.existsSync(full) && fs.statSync(full).isFile()) {
            codeListings.push({
              filename: rel.replace(/\\/g, '/'),
              code: fs.readFileSync(full, 'utf-8')
            });
          }
        }
      }

      // 2. Build sections
      const sections = [
        {
          heading: '1. OBJECTIVE / AIM',
          paragraphs: [args.objective]
        }
      ];

      if (args.procedureSteps && args.procedureSteps.length > 0) {
        sections.push({
          heading: '2. PRACTICAL PROCEDURE & IMPLEMENTATION',
          bulletPoints: args.procedureSteps
        });
      }

      // 3. Resolve logo if not explicitly given
      let logo = args.logoPath;
      if (!logo) {
        const potentialLogos = ['gsfc_logo.png', 'logo.png', 'Msu_baroda_logo.png', 'msu_logo.png'];
        for (const pl of potentialLogos) {
          const checkP = path.join(args.projectDir, pl);
          if (fs.existsSync(checkP)) {
            logo = checkP;
            break;
          }
        }
      }

      // 4. Generate HTML
      const htmlFileName = 'Practical_Report.html';
      const htmlPath = path.join(args.projectDir, htmlFileName);

      const css = getReportCSS(args.stylePreset);
      let sectionsHtml = '';
      for (const sec of sections) {
        sectionsHtml += `\n<h2>${escapeHTML(sec.heading)}</h2>`;
        if (sec.paragraphs) {
          for (const p of sec.paragraphs) sectionsHtml += `\n<p>${p}</p>`;
        }
        if (sec.bulletPoints) {
          sectionsHtml += '\n<ul>';
          for (const bp of sec.bulletPoints) sectionsHtml += `\n  <li>${bp}</li>`;
          sectionsHtml += '\n</ul>';
        }
      }

      let codeHtml = '';
      if (codeListings.length > 0) {
        codeHtml += '\n<h2>3. SOURCE CODE LISTINGS</h2>';
        for (const item of codeListings) {
          codeHtml += `
            <div class="code-title">File: ${escapeHTML(item.filename)}</div>
            <pre>${escapeHTML(item.code)}</pre>
          `;
        }
      }

      let figuresHtml = '';
      if (args.screenshots && args.screenshots.length > 0) {
        figuresHtml += '\n<h2>4. OUTPUT SCREENSHOTS</h2>';
        for (const fig of args.screenshots) {
          const fullImgPath = path.isAbsolute(fig.imagePath) ? fig.imagePath : path.join(args.projectDir, fig.imagePath);
          const b64 = getBase64Image(fullImgPath);
          figuresHtml += `
            <div class="image-container">
              <div class="image-caption">${escapeHTML(fig.caption)}</div>
              <img src="${b64}" alt="${escapeHTML(fig.caption)}" />
            </div>
          `;
        }
      }

      const fullHtml = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>${escapeHTML(args.title)}</title>
  <style>
${css}
  </style>
</head>
<body>
  <h1>${escapeHTML(args.title)}</h1>
  ${args.subtitle ? `<p class="subtitle">${escapeHTML(args.subtitle)}</p>` : ''}

${sectionsHtml}
${codeHtml}
${figuresHtml}
</body>
</html>`;

      fs.writeFileSync(htmlPath, fullHtml, 'utf-8');

      // 5. Compile PDF(s)
      const defaultPdfPath = path.join(args.projectDir, 'Practical_Report.pdf');
      const execPath = getBrowserExecutablePath();
      const browser = await puppeteer.launch({
        executablePath: execPath,
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
      });

      const studentList = args.students && args.students.length > 0 ? args.students : [
        { name: 'Student', enrollment: 'ENROLLMENT_NO', batch: '5A - B', outputPdfFileName: 'Practical_Report.pdf' }
      ];

      const logoB64 = logo ? getBase64Image(logo) : '';
      const generatedPdfs = [];

      for (const student of studentList) {
        const page = await browser.newPage();
        await page.setContent(fullHtml, { waitUntil: 'load' });

        const targetFileName = student.outputPdfFileName || 'Practical_Report.pdf';
        const targetPath = path.join(args.projectDir, targetFileName);

        const headerHtml = `
          <div style="font-family: 'Times New Roman', Times, serif; font-size: 10pt; color: #000000; width: 100%; text-align: center; font-weight: bold; border-bottom: 1px solid #000000; padding-bottom: 4px; margin: 0 1.5cm;">
            Name: ${student.name} &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; Enrollment No: ${student.enrollment} &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; Class/Batch: ${student.batch || '5A - B'}
          </div>
        `;

        const footerHtml = `
          <div style="font-family: 'Times New Roman', Times, serif; font-size: 10pt; color: #000000; width: 100%; display: flex; justify-content: space-between; align-items: center; border-top: 1px solid #000000; padding-top: 4px; margin: 0 1.5cm;">
            <div style="text-align: left; font-weight: bold;">
              Subject: ${args.subject}
            </div>
            <div style="text-align: right;">
              ${logoB64 ? `<img src="${logoB64}" style="height: 26px; max-width: 100px; object-fit: contain;" alt="Logo" />` : ''}
            </div>
          </div>
        `;

        await page.pdf({
          path: targetPath,
          format: 'A4',
          printBackground: true,
          displayHeaderFooter: true,
          headerTemplate: headerHtml,
          footerTemplate: footerHtml,
          margin: {
            top: '22mm',
            bottom: '22mm',
            left: '15mm',
            right: '15mm'
          }
        });

        await page.close();
        generatedPdfs.push(targetPath);
      }

      await browser.close();

      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            status: 'success',
            htmlReport: htmlPath,
            pdfReports: generatedPdfs
          }, null, 2)
        }]
      };
    } catch (err) {
      return {
        isError: true,
        content: [{ type: 'text', text: `Complete report build failed: ${err.message}` }]
      };
    }
  }
);

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('report-craft MCP Server running on stdio');
}

main().catch(err => {
  console.error('Fatal error running server:', err);
  process.exit(1);
});
