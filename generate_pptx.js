const pptxgen = require("pptxgenjs");

const pres = new pptxgen();
pres.layout = 'LAYOUT_16x9';
pres.title = 'SleepNest - IoT Baby Monitoring System';

// Palette (NO # prefix ever)
const BG     = "0F1117";
const CARD   = "1E2236";
const CARD2  = "161928";
const ACCENT = "3B9E72";
const BLUE   = "5A52E0";
const AMBER  = "F59E0B";
const RED    = "EF4444";
const PURPLE = "A855F7";
const TEXT   = "E2E8F0";
const SUB    = "94A3B8";
const BORDER = "2A2E4A";
const WHITE  = "FFFFFF";

const makeShadow = () => ({ type: "outer", blur: 8, offset: 3, angle: 135, color: "000000", opacity: 0.3 });

// ─────────────────────────────────────────────────────────────
// SLIDE 1: Final System Overview
// ─────────────────────────────────────────────────────────────
{
  const s = pres.addSlide();
  s.background = { color: BG };

  s.addShape(pres.shapes.RECTANGLE, { x: 0, y: 0, w: 10, h: 0.08, fill: { color: ACCENT }, line: { color: ACCENT } });
  s.addShape(pres.shapes.RECTANGLE, { x: 0, y: 0.08, w: 0.08, h: 5.545, fill: { color: ACCENT }, line: { color: ACCENT } });

  s.addText("SleepNest", { x: 0.3, y: 0.22, w: 9.4, h: 0.75, fontSize: 52, fontFace: "Arial Black", color: WHITE, bold: true, align: "center", margin: 0 });
  s.addText("IoT Baby Monitoring System", { x: 0.3, y: 0.97, w: 9.4, h: 0.4, fontSize: 18, fontFace: "Calibri", color: ACCENT, align: "center", margin: 0 });
  s.addText("Real-time environment monitoring using Machine Learning  ·  IT4021 Group Assignment 2026  ·  Team: 4 Students", { x: 0.3, y: 1.38, w: 9.4, h: 0.3, fontSize: 11, fontFace: "Calibri", color: SUB, align: "center", margin: 0 });

  // 4 stat boxes
  const stats = [
    { val: "5", label: "Physical Sensors", color: ACCENT },
    { val: "4", label: "ML Models", color: BLUE },
    { val: "92.8%", label: "Model Accuracy", color: AMBER },
    { val: "2s", label: "Update Rate", color: RED },
  ];
  stats.forEach((st, i) => {
    const x = 0.4 + i * 2.3;
    s.addShape(pres.shapes.RECTANGLE, { x, y: 1.82, w: 2.1, h: 0.98, fill: { color: CARD }, line: { color: st.color, pt: 1.5 }, shadow: makeShadow() });
    s.addText(st.val, { x, y: 1.88, w: 2.1, h: 0.45, fontSize: 26, bold: true, color: st.color, align: "center", fontFace: "Arial Black", margin: 0 });
    s.addText(st.label, { x, y: 2.3, w: 2.1, h: 0.3, fontSize: 10, color: SUB, align: "center", fontFace: "Calibri", margin: 0 });
  });

  // Hardware card
  s.addShape(pres.shapes.RECTANGLE, { x: 0.2, y: 3.0, w: 4.55, h: 2.1, fill: { color: CARD }, line: { color: BLUE, pt: 1 }, shadow: makeShadow() });
  s.addShape(pres.shapes.RECTANGLE, { x: 0.2, y: 3.0, w: 0.07, h: 2.1, fill: { color: BLUE }, line: { color: BLUE } });
  s.addText("Hardware Stack", { x: 0.35, y: 3.06, w: 4.2, h: 0.36, fontSize: 13, bold: true, color: BLUE, fontFace: "Arial Black", margin: 0 });
  s.addText([
    { text: "Arduino Uno — DHT11 (Temp/Humidity), PIR (Motion), LDR (Light)", options: { bullet: true, breakLine: true } },
    { text: "ESP32 — WiFi Gateway + INMP441 I2S Microphone (Audio)", options: { bullet: true, breakLine: true } },
    { text: "Detects: Crying · Restlessness · Abnormal temperature · Motion", options: { bullet: true, breakLine: true } },
    { text: "Communication: UART 9600 baud → WebSocket over WiFi", options: { bullet: true } },
  ], { x: 0.35, y: 3.46, w: 4.2, h: 1.55, fontSize: 11, color: TEXT, fontFace: "Calibri", margin: 0 });

  // Software card
  s.addShape(pres.shapes.RECTANGLE, { x: 5.05, y: 3.0, w: 4.7, h: 2.1, fill: { color: CARD }, line: { color: ACCENT, pt: 1 }, shadow: makeShadow() });
  s.addShape(pres.shapes.RECTANGLE, { x: 5.05, y: 3.0, w: 0.07, h: 2.1, fill: { color: ACCENT }, line: { color: ACCENT } });
  s.addText("Software Stack", { x: 5.2, y: 3.06, w: 4.4, h: 0.36, fontSize: 13, bold: true, color: ACCENT, fontFace: "Arial Black", margin: 0 });
  s.addText([
    { text: "Node.js + Express + WebSocket — Backend server (port 3007)", options: { bullet: true, breakLine: true } },
    { text: "React 18 + Vite + Tailwind CSS — 11-page live dashboard", options: { bullet: true, breakLine: true } },
    { text: "MongoDB Atlas — NoSQL cloud database (3 collections)", options: { bullet: true, breakLine: true } },
    { text: "ONNX Runtime — Live ML inference every 2 seconds", options: { bullet: true } },
  ], { x: 5.2, y: 3.46, w: 4.4, h: 1.55, fontSize: 11, color: TEXT, fontFace: "Calibri", margin: 0 });

  s.addText("1 / 8", { x: 8.5, y: 5.35, w: 1.3, h: 0.22, fontSize: 10, color: SUB, align: "right", margin: 0 });
}

// ─────────────────────────────────────────────────────────────
// SLIDE 2: Architecture and Data Flow
// ─────────────────────────────────────────────────────────────
{
  const s = pres.addSlide();
  s.background = { color: BG };

  s.addShape(pres.shapes.RECTANGLE, { x: 0, y: 0, w: 10, h: 0.08, fill: { color: ACCENT }, line: { color: ACCENT } });
  s.addText("System Architecture & Data Flow", { x: 0.3, y: 0.15, w: 9.4, h: 0.52, fontSize: 28, fontFace: "Arial Black", color: WHITE, bold: true, align: "left", margin: 0 });
  s.addText("End-to-end pipeline: physical sensors → ML inference → MongoDB → live React dashboard", { x: 0.3, y: 0.68, w: 9.4, h: 0.28, fontSize: 12, color: SUB, fontFace: "Calibri", align: "left", margin: 0 });

  const nodes = [
    { label: "Arduino Uno",    color: "4472C4", details: ["DHT11 Temp/Humidity", "PIR Motion Sensor", "LDR Light Sensor", "UART 9600 baud", "Every 2 seconds"] },
    { label: "ESP32 Gateway",  color: ACCENT,   details: ["INMP441 I2S Mic", "Reads Arduino UART", "WiFi + WebSocket", "Audio processing", "Crying detection"] },
    { label: "Node.js Server", color: AMBER,    details: ["WebSocket receiver", "ONNX ML inference", "DataBuffer 30s flush", "REST API :3007", "Log files + alerts"] },
    { label: "MongoDB Atlas",  color: "E8710A", details: ["readings collection", "events collection", "hourly_stats", "TTL 7 days", "Atlas cloud"] },
    { label: "React Dashboard",color: SUB,      details: ["Polls /api every 2s", "11 pages live", "Chart.js charts", "Dark/light theme", "Port 5173"] },
  ];

  const boxW = 1.6;
  const boxH = 3.1;
  const gapX = 0.35;
  const startX = 0.18;
  const boxY = 1.08;

  nodes.forEach((n, i) => {
    const x = startX + i * (boxW + gapX);
    s.addShape(pres.shapes.RECTANGLE, { x, y: boxY, w: boxW, h: boxH, fill: { color: CARD }, line: { color: n.color, pt: 1.5 }, shadow: makeShadow() });
    s.addShape(pres.shapes.RECTANGLE, { x, y: boxY, w: boxW, h: 0.06, fill: { color: n.color }, line: { color: n.color } });
    // Number circle
    s.addShape(pres.shapes.OVAL, { x: x + boxW / 2 - 0.22, y: boxY + 0.1, w: 0.44, h: 0.44, fill: { color: n.color }, line: { color: n.color } });
    s.addText(String(i + 1), { x: x + boxW / 2 - 0.22, y: boxY + 0.1, w: 0.44, h: 0.44, fontSize: 14, bold: true, color: WHITE, align: "center", valign: "middle", fontFace: "Arial Black", margin: 0 });
    s.addText(n.label, { x, y: boxY + 0.6, w: boxW, h: 0.38, fontSize: 11, bold: true, color: WHITE, fontFace: "Arial Black", align: "center", margin: 0 });
    s.addShape(pres.shapes.LINE, { x: x + 0.12, y: boxY + 1.04, w: boxW - 0.24, h: 0, line: { color: BORDER, width: 1 } });
    s.addText(n.details.map((d, di) => ({ text: d, options: { bullet: true, breakLine: di < n.details.length - 1, color: TEXT } })),
      { x: x + 0.08, y: boxY + 1.12, w: boxW - 0.12, h: 1.85, fontSize: 9.5, fontFace: "Calibri", margin: 0 });

    // Arrow
    if (i < nodes.length - 1) {
      const ax = x + boxW + 0.06;
      const ay = boxY + boxH / 2 - 0.02;
      s.addShape(pres.shapes.LINE, { x: ax, y: ay, w: gapX - 0.14, h: 0, line: { color: ACCENT, width: 2.5 } });
      s.addText(">", { x: ax + gapX - 0.26, y: ay - 0.2, w: 0.22, h: 0.4, fontSize: 16, color: ACCENT, bold: true, margin: 0 });
    }
  });

  s.addShape(pres.shapes.RECTANGLE, { x: 0.18, y: 4.35, w: 9.64, h: 0.48, fill: { color: CARD }, line: { color: AMBER, pt: 1 } });
  s.addText("ML Inference: Every reading runs through the ONNX Random Forest model in Node.js (step 3) before being stored → classification is part of the data, not post-processing", {
    x: 0.32, y: 4.38, w: 9.35, h: 0.43, fontSize: 11, color: AMBER, fontFace: "Calibri", align: "left", margin: 0
  });

  s.addText("2 / 8", { x: 8.5, y: 5.35, w: 1.3, h: 0.22, fontSize: 10, color: SUB, align: "right", margin: 0 });
}

// ─────────────────────────────────────────────────────────────
// SLIDE 3: Database Design
// ─────────────────────────────────────────────────────────────
{
  const s = pres.addSlide();
  s.background = { color: BG };

  s.addShape(pres.shapes.RECTANGLE, { x: 0, y: 0, w: 10, h: 0.08, fill: { color: ACCENT }, line: { color: ACCENT } });
  s.addText("MongoDB Database Design", { x: 0.3, y: 0.15, w: 9.4, h: 0.52, fontSize: 28, fontFace: "Arial Black", color: WHITE, bold: true, align: "left", margin: 0 });
  s.addText("3 collections · batch writes every 30s · TTL auto-cleanup · JSON-native for Node.js", { x: 0.3, y: 0.68, w: 9.4, h: 0.28, fontSize: 12, color: SUB, fontFace: "Calibri", align: "left", margin: 0 });

  const cols = [
    {
      name: "readings", color: ACCENT, freq: "Flushed every 30s (~15 readings per doc)",
      fields: ["deviceId  ·  ts (timestamp)  ·  sampleCount", "temp: { avg, min, max, last }", "humidity: { avg, min, max, last }", "sound: { avg, max, last, event }", "comfort: { avg, last }", "motion: { samplesActive, durationMs }", "light: { avg, last }", "soundHist: { QUIET, LIGHT_ACTIVITY, RESTLESS, CRYING }", "lastRaw: { full snapshot of last reading }"]
    },
    {
      name: "events", color: RED, freq: "Written immediately on state change (edge-triggered)",
      fields: ["deviceId  ·  ts  ·  category", "category: 'sound' | 'motion'", "type: QUIET | LIGHT_ACTIVITY | RESTLESS | CRYING", "prevType: previous sound class", "soundLevel: raw sensor value", "soundDiff: change delta", "db: decibel reading", "", "Triggers: sound escalation edges", "motion start / motion end"]
    },
    {
      name: "hourly_stats", color: BLUE, freq: "Aggregated every hour by Aggregator.js",
      fields: ["deviceId  ·  hour (UTC bucket)", "avgTemp  ·  minTemp  ·  maxTemp", "avgHumidity  ·  avgSound  ·  maxSound", "avgComfort  ·  motionEvents", "soundEvents: { QUIET, LIGHT_ACTIVITY,", "   RESTLESS, CRYING } counts", "", "Used for: trend charts, correlation", "analysis, historical reporting", "and dashboard history page"]
    }
  ];

  cols.forEach((c, i) => {
    const x = 0.18 + i * 3.27;
    s.addShape(pres.shapes.RECTANGLE, { x, y: 1.08, w: 3.12, h: 4.25, fill: { color: CARD }, line: { color: c.color, pt: 1.5 }, shadow: makeShadow() });
    s.addShape(pres.shapes.RECTANGLE, { x, y: 1.08, w: 3.12, h: 0.62, fill: { color: c.color }, line: { color: c.color } });
    s.addText(c.name, { x, y: 1.1, w: 3.12, h: 0.38, fontSize: 15, bold: true, color: WHITE, fontFace: "Arial Black", align: "center", margin: 0 });
    s.addText(c.freq, { x, y: 1.48, w: 3.12, h: 0.2, fontSize: 8.5, color: WHITE, fontFace: "Calibri", align: "center", margin: 0 });
    s.addText(c.fields.map((f, fi) => ({
      text: f, options: { bullet: f !== "" && fi > 0, breakLine: fi < c.fields.length - 1, color: fi === 0 ? c.color : TEXT }
    })), { x: x + 0.12, y: 1.78, w: 2.9, h: 3.45, fontSize: 10, fontFace: "Calibri", margin: 0 });
  });

  s.addShape(pres.shapes.RECTANGLE, { x: 0.18, y: 5.38, w: 9.64, h: 0.18, fill: { color: CARD2 }, line: { color: BORDER } });
  s.addText("Why MongoDB over SQL: Schema-flexible (add new sensors without migration) · Fast writes · TTL index auto-deletes readings after 7 days · JSON = no ORM needed", {
    x: 0.3, y: 5.39, w: 9.4, h: 0.16, fontSize: 9.5, color: SUB, fontFace: "Calibri", align: "center", margin: 0
  });

  s.addText("3 / 8", { x: 8.5, y: 5.55, w: 1.3, h: 0.22, fontSize: 10, color: SUB, align: "right", margin: 0 });
}

// ─────────────────────────────────────────────────────────────
// SLIDE 4: ML Models & Data Analysis
// ─────────────────────────────────────────────────────────────
{
  const s = pres.addSlide();
  s.background = { color: BG };

  s.addShape(pres.shapes.RECTANGLE, { x: 0, y: 0, w: 10, h: 0.08, fill: { color: ACCENT }, line: { color: ACCENT } });
  s.addText("ML Models & Data Analysis", { x: 0.3, y: 0.15, w: 9.4, h: 0.52, fontSize: 28, fontFace: "Arial Black", color: WHITE, bold: true, align: "left", margin: 0 });
  s.addText("4 trained models covering all 5 assignment analysis requirements — supervised + unsupervised learning", { x: 0.3, y: 0.68, w: 9.4, h: 0.28, fontSize: 12, color: SUB, fontFace: "Calibri", align: "left", margin: 0 });

  const models = [
    { title: "Random Forest", type: "Supervised · Classification", color: ACCENT, stats: [["92.8%", "Accuracy"], ["0.928", "F1 Score"], ["10,000", "Train rows"], ["4", "Classes"]], desc: "Classifies each sensor reading into QUIET / LIGHT_ACTIVITY / RESTLESS / CRYING. Deployed via ONNX in Node.js. Runs live every 2 seconds." },
    { title: "Isolation Forest", type: "Unsupervised · Anomaly Detection", color: RED, stats: [["0.804", "Precision"], ["0.790", "Recall"], ["1,211", "Train samples"], ["8%", "Contamination"]], desc: "Trained only on QUIET (normal) readings. Flags anomalous sensor states without ever seeing labelled 'bad' data." },
    { title: "K-Means Clustering", type: "Unsupervised · Behavior Patterns", color: BLUE, stats: [["k=3", "Clusters"], ["0.424", "Silhouette"], ["6", "Features"], ["Elbow", "Selection"]], desc: "Discovers 3 natural behavior states from data alone: Quiet & Comfortable, Light Activity, Restless/Noisy." },
    { title: "Linear Regression", type: "Statistical · Trend Analysis", color: AMBER, stats: [["7-pt", "Rolling avg"], ["Live", "Updates"], ["3", "Metrics"], ["Slope", "Trend dir"]], desc: "Applies rolling average to smooth noise, then fits regression line to show if comfort/temp/sound is improving or worsening over time." },
  ];

  models.forEach((m, i) => {
    const col = i % 2;
    const row = Math.floor(i / 2);
    const x = 0.18 + col * 4.92;
    const y = 1.06 + row * 2.25;
    const w = 4.68;
    const h = 2.1;

    s.addShape(pres.shapes.RECTANGLE, { x, y, w, h, fill: { color: CARD }, line: { color: m.color, pt: 1 }, shadow: makeShadow() });
    s.addShape(pres.shapes.RECTANGLE, { x, y, w: 0.07, h, fill: { color: m.color }, line: { color: m.color } });

    s.addText(m.title, { x: x + 0.15, y: y + 0.08, w: w - 0.2, h: 0.34, fontSize: 14, bold: true, color: WHITE, fontFace: "Arial Black", margin: 0 });
    s.addText(m.type, { x: x + 0.15, y: y + 0.42, w: w - 0.2, h: 0.22, fontSize: 9.5, color: m.color, fontFace: "Calibri", margin: 0 });

    m.stats.forEach((st, si) => {
      const sx = x + 0.15 + si * 1.1;
      s.addShape(pres.shapes.RECTANGLE, { x: sx, y: y + 0.68, w: 1.02, h: 0.44, fill: { color: CARD2 }, line: { color: BORDER } });
      s.addText(st[0], { x: sx, y: y + 0.7, w: 1.02, h: 0.24, fontSize: 12, bold: true, color: m.color, align: "center", fontFace: "Arial Black", margin: 0 });
      s.addText(st[1], { x: sx, y: y + 0.9, w: 1.02, h: 0.18, fontSize: 8, color: SUB, align: "center", fontFace: "Calibri", margin: 0 });
    });

    s.addText(m.desc, { x: x + 0.15, y: y + 1.2, w: w - 0.25, h: 0.78, fontSize: 10, color: SUB, fontFace: "Calibri", margin: 0 });
  });

  s.addText("4 / 8", { x: 8.5, y: 5.35, w: 1.3, h: 0.22, fontSize: 10, color: SUB, align: "right", margin: 0 });
}

// ─────────────────────────────────────────────────────────────
// SLIDE 5: Dashboard Demonstration
// ─────────────────────────────────────────────────────────────
{
  const s = pres.addSlide();
  s.background = { color: BG };

  s.addShape(pres.shapes.RECTANGLE, { x: 0, y: 0, w: 10, h: 0.08, fill: { color: ACCENT }, line: { color: ACCENT } });
  s.addText("Interactive Dashboard  —  11 Pages", { x: 0.3, y: 0.15, w: 9.4, h: 0.52, fontSize: 26, fontFace: "Arial Black", color: WHITE, bold: true, align: "left", margin: 0 });
  s.addText("React 18 + Chart.js · polls every 2s · dark theme · 8+ visualization types", { x: 0.3, y: 0.68, w: 9.4, h: 0.28, fontSize: 12, color: SUB, fontFace: "Calibri", align: "left", margin: 0 });

  const pages = [
    { icon: "👁️", name: "Baby Sitter View",  desc: "Full-screen comfort arc gauge, default landing", color: ACCENT },
    { icon: "🏠", name: "Overview",           desc: "Live sensor cards, comfort score, device status", color: ACCENT },
    { icon: "📊", name: "Monitoring",         desc: "Real-time line charts: temp, sound, motion history", color: BLUE },
    { icon: "💤", name: "Sleep Analysis",     desc: "Sleep quality score, sound class bar chart", color: BLUE },
    { icon: "🔔", name: "Alerts",             desc: "Alert log: CRYING / RESTLESS detection events", color: RED },
    { icon: "📋", name: "History",            desc: "Full session data table — last 500 readings", color: SUB },
    { icon: "⚙️", name: "Settings",           desc: "ML threshold config — persisted to config.json", color: SUB },
    { icon: "📈", name: "Trend Analysis",     desc: "Live regression charts — rolling avg + trend line", color: AMBER },
    { icon: "🔗", name: "Correlation",        desc: "Live Pearson r cards + scatter plot by class", color: AMBER },
    { icon: "🚨", name: "Anomaly Detection",  desc: "Anomaly status, score gauge, recent events log", color: RED },
    { icon: "🔵", name: "Behavior Patterns",  desc: "Live K-Means cluster scatter + session distribution", color: BLUE },
  ];

  pages.forEach((p, i) => {
    const col = i < 6 ? 0 : 1;
    const row = i < 6 ? i : i - 6;
    const x = 0.18 + col * 5.05;
    const y = 1.06 + row * 0.73;
    const w = 4.72;
    const h = 0.65;

    s.addShape(pres.shapes.RECTANGLE, { x, y, w, h, fill: { color: CARD }, line: { color: BORDER }, shadow: makeShadow() });
    s.addShape(pres.shapes.RECTANGLE, { x, y, w: 0.07, h, fill: { color: p.color }, line: { color: p.color } });
    s.addText(p.icon + "  " + p.name, { x: x + 0.15, y: y + 0.07, w: w - 0.2, h: 0.28, fontSize: 12, bold: true, color: WHITE, fontFace: "Arial Black", margin: 0 });
    s.addText(p.desc, { x: x + 0.15, y: y + 0.36, w: w - 0.2, h: 0.22, fontSize: 10, color: SUB, fontFace: "Calibri", margin: 0 });
  });

  s.addShape(pres.shapes.RECTANGLE, { x: 0.18, y: 5.38, w: 9.64, h: 0.18, fill: { color: CARD2 }, line: { color: ACCENT, pt: 1 } });
  s.addText("Viz types: Line charts  ·  Bar charts  ·  Scatter plots  ·  Arc gauge  ·  Data tables  ·  Stacked bars  ·  Violin plots  ·  Correlation heatmaps", {
    x: 0.3, y: 5.39, w: 9.4, h: 0.16, fontSize: 9.5, color: ACCENT, fontFace: "Calibri", align: "center", margin: 0
  });

  s.addText("5 / 8", { x: 8.5, y: 5.55, w: 1.3, h: 0.22, fontSize: 10, color: SUB, align: "right", margin: 0 });
}

// ─────────────────────────────────────────────────────────────
// SLIDE 6: Software Design Decisions
// ─────────────────────────────────────────────────────────────
{
  const s = pres.addSlide();
  s.background = { color: BG };

  s.addShape(pres.shapes.RECTANGLE, { x: 0, y: 0, w: 10, h: 0.08, fill: { color: ACCENT }, line: { color: ACCENT } });
  s.addText("Software Engineering & Design Decisions", { x: 0.3, y: 0.15, w: 9.4, h: 0.52, fontSize: 24, fontFace: "Arial Black", color: WHITE, bold: true, align: "left", margin: 0 });
  s.addText("Key architectural choices and the engineering reasoning behind each one", { x: 0.3, y: 0.68, w: 9.4, h: 0.28, fontSize: 12, color: SUB, fontFace: "Calibri", align: "left", margin: 0 });

  const decisions = [
    { num: "01", title: "ONNX for ML Inference", color: ACCENT, problem: "Needed Python-trained models to run inside Node.js without a Python runtime", solution: "Same process handles API + ML inference · ~5ms per prediction · no microservice" },
    { num: "02", title: "DataBuffer Batching (30s flush)", color: BLUE, problem: "ESP32 sends every 2s = 1,800 raw MongoDB writes/hour → Atlas free tier limits hit", solution: "Aggregated doc every 30s = 120 writes/hour · 15x reduction · stores min/max/avg stats" },
    { num: "03", title: "React SensorContext (Global State)", color: AMBER, problem: "11 pages all polling /api separately would cause 11× the requests every 2 seconds", solution: "Single context polls once, distributes live data to all components automatically" },
    { num: "04", title: "Config.json Threshold Persistence", color: RED, problem: "ML thresholds reset to code defaults on every server restart — lost user tuning", solution: "Settings page writes config.json · server reads on startup · survives restarts" },
    { num: "05", title: "Synthetic Dataset + Noise Engineering", color: PURPLE, problem: "Only 2 days of real data — insufficient for robust model training (100% accuracy overfit)", solution: "25% borderline + 10% outliers + 6% label noise → 10,000 rows → 92.8% accuracy" },
  ];

  decisions.forEach((d, i) => {
    const y = 1.06 + i * 0.88;
    s.addShape(pres.shapes.RECTANGLE, { x: 0.18, y, w: 9.64, h: 0.8, fill: { color: CARD }, line: { color: BORDER }, shadow: makeShadow() });
    s.addShape(pres.shapes.RECTANGLE, { x: 0.18, y, w: 0.07, h: 0.8, fill: { color: d.color }, line: { color: d.color } });

    s.addShape(pres.shapes.RECTANGLE, { x: 0.33, y: y + 0.18, w: 0.44, h: 0.44, fill: { color: d.color }, line: { color: d.color } });
    s.addText(d.num, { x: 0.33, y: y + 0.18, w: 0.44, h: 0.44, fontSize: 12, bold: true, color: WHITE, align: "center", valign: "middle", fontFace: "Arial Black", margin: 0 });

    s.addText(d.title, { x: 0.88, y: y + 0.07, w: 3.8, h: 0.32, fontSize: 13, bold: true, color: WHITE, fontFace: "Arial Black", margin: 0 });
    s.addText("Problem: " + d.problem, { x: 0.88, y: y + 0.4, w: 4.3, h: 0.33, fontSize: 9.5, color: SUB, fontFace: "Calibri", margin: 0 });
    s.addText("Solution: " + d.solution, { x: 5.35, y: y + 0.1, w: 4.35, h: 0.6, fontSize: 10.5, color: d.color, fontFace: "Calibri", margin: 0 });
  });

  s.addText("6 / 8", { x: 8.5, y: 5.35, w: 1.3, h: 0.22, fontSize: 10, color: SUB, align: "right", margin: 0 });
}

// ─────────────────────────────────────────────────────────────
// SLIDE 7: Challenges & Lessons Learned
// ─────────────────────────────────────────────────────────────
{
  const s = pres.addSlide();
  s.background = { color: BG };

  s.addShape(pres.shapes.RECTANGLE, { x: 0, y: 0, w: 10, h: 0.08, fill: { color: RED }, line: { color: RED } });
  s.addText("Challenges & Lessons Learned", { x: 0.3, y: 0.15, w: 9.4, h: 0.52, fontSize: 28, fontFace: "Arial Black", color: WHITE, bold: true, align: "left", margin: 0 });
  s.addText("5 real engineering challenges encountered and resolved during development", { x: 0.3, y: 0.68, w: 9.4, h: 0.28, fontSize: 12, color: SUB, fontFace: "Calibri", align: "left", margin: 0 });

  const challenges = [
    { icon: "🔊", title: "Sound Threshold Calibration", color: AMBER, problem: "Ambient noise floor ~70 always triggered CRYING — constant false alerts from day 1", fix: "Analysed real data histogram → tuned thresholds to 70/110/250/400", lesson: "Always profile your real sensor data before setting any threshold values" },
    { icon: "🎯", title: "Model Overfitting (100% accuracy)", color: RED, problem: "First synthetic dataset was too clean — model memorised instead of generalising", fix: "Added 25% borderline samples + 10% outliers + 6% label noise → 92.8%", lesson: "Perfect accuracy is a red flag. Real-world data is noisy — your model must be too" },
    { icon: "🔌", title: "ESP32 Payload Format Changed", color: BLUE, problem: "Firmware update changed the JSON payload structure — server broke silently on restart", fix: "Built adaptESP32DataFormat() adapter layer between hardware and application logic", lesson: "Always add an adapter/parser at hardware boundaries to absorb format changes" },
    { icon: "💾", title: "MongoDB Write Rate Limits", color: ACCENT, problem: "2s sensor polling = 1,800 direct writes/hour → Atlas free tier rate limits triggered", fix: "DataBuffer pattern — buffer 30s of readings in memory, write one aggregated doc", lesson: "Design IoT persistence for write efficiency from the start, not as an afterthought" },
    { icon: "🧠", title: "Running ML in Node.js", color: PURPLE, problem: "Models trained in Python (sklearn) but production environment is Node.js/Express", fix: "Exported trained model to ONNX format → loaded with onnxruntime-node in server", lesson: "ONNX is the universal cross-platform ML deployment format — learn it early" },
  ];

  challenges.forEach((c, i) => {
    const col = i < 3 ? 0 : 1;
    const row = i < 3 ? i : i - 3;
    const x = 0.18 + col * 4.96;
    const y = 1.06 + row * 1.48;
    const w = 4.7;
    const h = 1.36;

    s.addShape(pres.shapes.RECTANGLE, { x, y, w, h, fill: { color: CARD }, line: { color: c.color, pt: 1 }, shadow: makeShadow() });
    s.addShape(pres.shapes.RECTANGLE, { x, y, w, h: 0.06, fill: { color: c.color }, line: { color: c.color } });

    s.addText(c.icon + "  " + c.title, { x: x + 0.1, y: y + 0.1, w: w - 0.15, h: 0.3, fontSize: 12, bold: true, color: WHITE, fontFace: "Arial Black", margin: 0 });
    s.addText("Problem: " + c.problem, { x: x + 0.1, y: y + 0.43, w: w - 0.15, h: 0.28, fontSize: 9.5, color: RED, fontFace: "Calibri", margin: 0 });
    s.addText("Fix: " + c.fix, { x: x + 0.1, y: y + 0.7, w: w - 0.15, h: 0.28, fontSize: 9.5, color: ACCENT, fontFace: "Calibri", margin: 0 });
    s.addText("Lesson: " + c.lesson, { x: x + 0.1, y: y + 0.98, w: w - 0.15, h: 0.28, fontSize: 9, color: c.color, fontFace: "Calibri", italic: true, margin: 0 });
  });

  s.addText("7 / 8", { x: 8.5, y: 5.35, w: 1.3, h: 0.22, fontSize: 10, color: SUB, align: "right", margin: 0 });
}

// ─────────────────────────────────────────────────────────────
// SLIDE 8: Future Enhancements
// ─────────────────────────────────────────────────────────────
{
  const s = pres.addSlide();
  s.background = { color: BG };

  s.addShape(pres.shapes.RECTANGLE, { x: 0, y: 0, w: 10, h: 0.08, fill: { color: BLUE }, line: { color: BLUE } });
  s.addText("Future Enhancements", { x: 0.3, y: 0.15, w: 9.4, h: 0.52, fontSize: 28, fontFace: "Arial Black", color: WHITE, bold: true, align: "left", margin: 0 });
  s.addText("Short-term improvements · medium-term features · long-term research directions", { x: 0.3, y: 0.68, w: 9.4, h: 0.28, fontSize: 12, color: SUB, fontFace: "Calibri", align: "left", margin: 0 });

  const tiers = [
    { label: "Short-term", color: ACCENT, items: ["Mobile app (React Native) + push alerts for crying events", "Edge inference on ESP32 via TensorFlow Lite (offline mode)", "Email / SMS alerts via Twilio on anomaly detection", "Auto-regenerate ML charts when new data is collected"] },
    { label: "Medium-term", color: AMBER, items: ["Multi-baby / multi-room support (multiple device IDs)", "Parent sleep pattern correlation with baby sleep data", "Monthly model retraining as dataset grows beyond 7 days", "Grafana integration for operational-level dashboards"] },
    { label: "Long-term", color: BLUE, items: ["LSTM model — predict crying before it happens (forecasting)", "Federated learning — shared model across families privately", "Smart home integration: lights dim when baby sleeps", "Clinical sleep reports exportable for pediatrician review"] },
  ];

  tiers.forEach((t, i) => {
    const x = 0.18 + i * 3.27;
    s.addShape(pres.shapes.RECTANGLE, { x, y: 1.06, w: 3.12, h: 3.9, fill: { color: CARD }, line: { color: t.color, pt: 1.5 }, shadow: makeShadow() });
    s.addShape(pres.shapes.RECTANGLE, { x, y: 1.06, w: 3.12, h: 0.56, fill: { color: t.color }, line: { color: t.color } });
    s.addText(t.label, { x, y: 1.08, w: 3.12, h: 0.38, fontSize: 16, bold: true, color: WHITE, fontFace: "Arial Black", align: "center", margin: 0 });

    t.items.forEach((item, ii) => {
      const iy = 1.72 + ii * 0.76;
      s.addShape(pres.shapes.RECTANGLE, { x: x + 0.1, y: iy, w: 2.92, h: 0.68, fill: { color: CARD2 }, line: { color: BORDER } });
      s.addShape(pres.shapes.RECTANGLE, { x: x + 0.1, y: iy, w: 0.06, h: 0.68, fill: { color: t.color }, line: { color: t.color } });
      s.addText(item, { x: x + 0.22, y: iy + 0.08, w: 2.75, h: 0.54, fontSize: 10, color: TEXT, fontFace: "Calibri", margin: 0 });
    });
  });

  s.addShape(pres.shapes.RECTANGLE, { x: 0.18, y: 5.1, w: 9.64, h: 0.44, fill: { color: CARD }, line: { color: PURPLE, pt: 1 } });
  s.addText("Research direction: Investigate FFT spectral features — can frequency-domain sound analysis push accuracy beyond 92.8%? LSTM time-series cry prediction?", {
    x: 0.32, y: 5.13, w: 9.35, h: 0.38, fontSize: 11, color: PURPLE, fontFace: "Calibri", align: "left", margin: 0
  });

  s.addText("8 / 8", { x: 8.5, y: 5.55, w: 1.3, h: 0.22, fontSize: 10, color: SUB, align: "right", margin: 0 });
}

// ─────────────────────────────────────────────────────────────
// Save
// ─────────────────────────────────────────────────────────────
pres.writeFile({ fileName: "D:\\iot\\New folder\\kukka_arduino\\SleepNest_Presentation.pptx" })
  .then(() => console.log("Saved: SleepNest_Presentation.pptx"))
  .catch(err => console.error("Error:", err));
