# 📑 ReportCraft MCP (`report-craft-mcp`)

[![MCP Protocol](https://img.shields.io/badge/MCP-Protocol-blue.svg?style=flat-square)](https://modelcontextprotocol.io/)
[![Node.js](https://img.shields.io/badge/Node.js-v18%2B-green.svg?style=flat-square)](https://nodejs.org/)
[![Puppeteer](https://img.shields.io/badge/Puppeteer--Core-Automated-orange.svg?style=flat-square)](https://pptr.dev/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg?style=flat-square)](https://github.com/hitarthombre/report-craft-mcp/pulls)

> **A Universal Model Context Protocol (MCP) Server for AI Agents to autonomously generate academic assignment reports, lab practical documents, and project deliverables with institutional-grade formatting.**

---

## 🌟 Why ReportCraft?

When developers, students, and engineers ask AI coding assistants (Antigravity, Claude Desktop, Cursor, Copilot) to *"make a practical report"*, the agent typically responds with markdown text that needs tedious manual copying, image pasting, formatting, and PDF exporting.

**ReportCraft changes that completely:**
It equips any MCP-compatible AI agent with native capabilities to:
1. 📸 **Spin up and capture screenshots** of web apps, dashboards, and views using headless Edge/Chrome.
2. 💻 **Scan & extract source code** files automatically without manual prompt copying.
3. 🖼️ **Self-contain all media**: Embeds screenshots and institutional logos as Base64 data URIs so documents render 100% offline.
4. 🎓 **Institutional-Grade Formatting**: Out-of-the-box support for strict college formats (Times New Roman, borderless code listings, formal margins).
5. 👥 **Multi-Student Batch Generation**: Compiles separate, personalized PDFs with individualized header metadata (Name, PRN/Enrollment, Batch) for student teams in a single command.

---

## 📐 Architecture & Workflow

```
┌────────────────────────────────────────────────────────┐
│                   AI Assistant / Agent                 │
│         (Antigravity / Claude Desktop / Cursor)        │
└───────────────────────────┬────────────────────────────┘
                            │ (JSON-RPC over Stdio)
                            ▼
┌────────────────────────────────────────────────────────┐
│               ReportCraft MCP Server                   │
├────────────────────────────────────────────────────────┤
│  1. capture_screenshots                                │
│     └─ Launches Headless Chromium / Edge               │
│     └─ Navigates to app routes & captures full-page    │
│                                                        │
│  2. collect_source_files                               │
│     └─ Extracts code cleanly with syntax detection     │
│                                                        │
│  3. generate_report_html                               │
│     └─ Encodes images & logos into Base64              │
│     └─ Applies styling preset (academic / modern / ieee│
│                                                        │
│  4. compile_report_pdf                                 │
│     └─ Puppeteer A4 print engine                       │
│     └─ Dynamic Header & Footer (Logo + Metadata)       │
│     └─ Batch personalized student PDF export           │
└────────────────────────────────────────────────────────┘
```

---

## 🎨 Supported Style Presets

| Preset | Typography | Best For | Visual Tone |
| :--- | :--- | :--- | :--- |
| **`academic_formal`** (Default) | Times New Roman, 12pt, justified | University practicals, college lab journals, thesis reports | Classic institutional black & white, borderless Courier code blocks |
| **`modern_clean`** | Inter / Segoe UI, slate palettes | Technical product docs, engineering submissions | Contemporary tech feel, rounded code cards, soft drop shadows |
| **`ieee_style`** | Times New Roman, 11pt, numbered sections | Conference submissions, research project summaries | Formal academic two-column / numbered section layout |

---

## 🚀 Quick Setup & Installation

### Option 1: Claude Desktop

Add this to your `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "report-craft": {
      "command": "node",
      "args": ["/path/to/report-craft-mcp/index.js"]
    }
  }
}
```

### Option 2: Google Antigravity IDE

Add to your global `~/.gemini/config/mcp_config.json`:

```json
{
  "mcpServers": {
    "report-craft": {
      "command": "node",
      "args": ["C:\\Users\\ASUS\\.gemini\\mcp-servers\\report-craft-mcp\\index.js"]
    }
  }
}
```

### Option 3: Cursor / VS Code / Windsurf

Configure the MCP server under your assistant's settings:
```bash
node /path/to/report-craft-mcp/index.js
```

---

## 🛠️ MCP Tools Reference

### 1. `capture_screenshots`
Captures high-resolution webpage or application screenshots using headless Edge/Chrome.

```json
{
  "targets": [
    {
      "url": "http://localhost:5173/dashboard",
      "outputFileName": "dashboard.png",
      "fullPage": true,
      "delayMs": 500
    }
  ],
  "outputDir": "./screenshots"
}
```

### 2. `collect_source_files`
Extracts code files directly from the project directory, skipping `node_modules` and build directories.

```json
{
  "baseDir": "./my-project",
  "relativePaths": ["src/App.jsx", "src/Header.jsx", "src/App.css"]
}
```

### 3. `generate_report_html`
Generates an HTML report document with embedded Base64 images and the requested styling preset.

```json
{
  "title": "PRACTICAL ASSIGNMENT 6 REPORT",
  "subtitle": "COLLEGE COURSE & STUDENT MANAGEMENT SYSTEM USING REACT",
  "stylePreset": "academic_formal",
  "sections": [
    {
      "heading": "1. OBJECTIVE / AIM",
      "paragraphs": ["Develop a responsive student management portal."]
    }
  ],
  "codeListings": [
    { "filename": "src/App.jsx", "code": "// source code..." }
  ],
  "figures": [
    { "imagePath": "./dashboard.png", "caption": "Figure 1: Dashboard View" }
  ],
  "outputPath": "./Practical_Report.html"
}
```

### 4. `compile_report_pdf`
Compiles an HTML report file into academic A4 PDF(s) with institutional header/footer templates and multi-student batching.

```json
{
  "htmlPath": "./Practical_Report.html",
  "outputPdfPath": "./Practical_Report.pdf",
  "subject": "Advanced Web Technology",
  "logoPath": "./assets/gsfc_logo.png",
  "students": [
    { "name": "Hitarth Thombre", "enrollment": "25BT04D255", "batch": "5A - B", "outputPdfFileName": "Report_Hitarth.pdf" },
    { "name": "Trupti More", "enrollment": "25BT04D256", "batch": "5A - B", "outputPdfFileName": "Report_Trupti.pdf" }
  ]
}
```

### 5. `build_complete_assignment_report` (All-In-One Orchestrator)
Takes the project directory, student info, source files, and screenshots, and executes the entire pipeline in a single step.

---

## 📸 Sample Output Showcase

<p align="center">
  <img src="assets/report_preview.png" alt="ReportCraft Output Preview" width="800" style="border-radius: 8px; box-shadow: 0 4px 20px rgba(0,0,0,0.15);" />
</p>

### Generated Institutional Report Layout:
- **Header**: Centered metadata (`Name: Hitarth Thombre | Enrollment: 25BT04D255 | Batch: 5A - B`) with divider rule.
- **Body**: Clean sections, Courier New code listings, and crisp output figures.
- **Footer**: `Subject: Advanced Web Technology` with official university logo on the right.

See the `examples/` folder for sample HTML and PDF report artifacts.

---

## 🤝 Contributing

Contributions, feature requests, and suggestions are welcome!
Feel free to open an issue or submit a pull request.

1. Fork the Project
2. Create your Feature Branch (`git checkout -b feature/AmazingFeature`)
3. Commit your Changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the Branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

---

## 📄 License

Distributed under the **MIT License**. See `LICENSE` for more information.

---

**Developed with ❤️ by [Hitarth Thombre](https://github.com/hitarthombre)**
*(GSFC University - School of Technology)*
