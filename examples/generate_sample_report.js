import puppeteer from 'puppeteer-core';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function getBase64(filePath) {
  if (!fs.existsSync(filePath)) return '';
  const buf = fs.readFileSync(filePath);
  return `data:image/png;base64,${buf.toString('base64')}`;
}

const edgePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const logoPath = path.join(__dirname, 'gsfc_logo.png');
const dashPath = path.join(__dirname, 'dashboard_screenshot.png');
const studPath = path.join(__dirname, 'students_screenshot.png');

const logoB64 = getBase64(logoPath);
const dashB64 = getBase64(dashPath);
const studB64 = getBase64(studPath);

const sampleCode = `import React, { useState } from 'react';
import Navbar from './components/Navbar';
import DashboardCard from './components/DashboardCard';

export default function App() {
  const [activeTab, setActiveTab] = useState('dashboard');
  return (
    <div className="app-container">
      <Navbar active={activeTab} onSelect={setActiveTab} />
      <main className="main-content">
        <h1>College Student & Course Management System</h1>
        <DashboardCard title="Active Enrolments" count={250} />
      </main>
    </div>
  );
}`;

const htmlContent = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Practical 6 Report - React Components & Routing</title>
  <style>
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
  </style>
</head>
<body>
  <h1>PRACTICAL ASSIGNMENT 6 REPORT</h1>
  <p class="subtitle">COLLEGE COURSE &amp; STUDENT MANAGEMENT SYSTEM USING REACT</p>

  <h2>1. OBJECTIVE / AIM</h2>
  <p>
    Develop a modular React application featuring reusable components, client-side routing using React Router, state hooks, attendance warning badge conditional rendering, and academic report compilation.
  </p>

  <h2>2. IMPLEMENTATION PROCEDURE</h2>
  <ul>
    <li><strong>Step 1:</strong> Initialized React application with modern Vite bundling and SCSS modular design tokens.</li>
    <li><strong>Step 2:</strong> Developed interactive components (Navbar, StudentCard, CourseCard, DashboardCard).</li>
    <li><strong>Step 3:</strong> Established multi-route routing structure (/dashboard, /students, /courses).</li>
    <li><strong>Step 4:</strong> Automated UI verification and generated formal submission artifacts using ReportCraft MCP.</li>
  </ul>

  <h2>3. SOURCE CODE LISTINGS</h2>
  <div class="code-title">File: src/App.jsx</div>
  <pre>${sampleCode.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</pre>

  <h2>4. OUTPUT SCREENSHOTS</h2>
  <div class="image-container">
    <div class="image-caption">Figure 1: Dashboard Overview Screen (/dashboard)</div>
    <img src="${dashB64}" alt="Dashboard Screenshot" />
  </div>

  <div class="image-container">
    <div class="image-caption">Figure 2: Student Management Directory View (/students)</div>
    <img src="${studB64}" alt="Students Screenshot" />
  </div>
</body>
</html>`;

const outHtml = path.join(__dirname, 'Sample_Assignment_Report.html');
fs.writeFileSync(outHtml, htmlContent, 'utf-8');
console.log('Saved HTML to', outHtml);

async function buildPdf() {
  const browser = await puppeteer.launch({
    executablePath: edgePath,
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();
  await page.setContent(htmlContent, { waitUntil: 'load' });

  const outPdf = path.join(__dirname, 'Sample_Assignment_Report.pdf');
  await page.pdf({
    path: outPdf,
    format: 'A4',
    printBackground: true,
    displayHeaderFooter: true,
    headerTemplate: `
      <div style="font-family: 'Times New Roman', Times, serif; font-size: 10pt; color: #000000; width: 100%; text-align: center; font-weight: bold; border-bottom: 1px solid #000000; padding-bottom: 4px; margin: 0 1.5cm;">
        Name: Hitarth Thombre &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; Enrollment No: 25BT04D255 &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; Class/Batch: 5A - B
      </div>
    `,
    footerTemplate: `
      <div style="font-family: 'Times New Roman', Times, serif; font-size: 10pt; color: #000000; width: 100%; display: flex; justify-content: space-between; align-items: center; border-top: 1px solid #000000; padding-top: 4px; margin: 0 1.5cm;">
        <div style="text-align: left; font-weight: bold;">
          Subject: Advanced Web Technology
        </div>
        <div style="text-align: right;">
          <img src="${logoB64}" style="height: 26px; max-width: 100px; object-fit: contain;" alt="GSFCU Logo" />
        </div>
      </div>
    `,
    margin: {
      top: '22mm',
      bottom: '22mm',
      left: '15mm',
      right: '15mm'
    }
  });

  await browser.close();
  console.log('Successfully generated PDF at', outPdf);
}

buildPdf().catch(console.error);
