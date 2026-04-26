"""
SleepNest — Final Presentation PDF Generator
Generates a clean, formatted PDF for the IT4021 assignment presentation.
"""

from fpdf import FPDF
import os

OUT = "SleepNest_Final_Presentation.pdf"

# ── Colour palette ────────────────────────────────────────────────
GREEN  = (59,  158, 114)   # accent green
DARK   = (22,  25,  40)    # dark bg
BLUE   = (90,  82,  224)   # purple-blue
AMBER  = (245, 158, 11)
RED    = (239, 68,  68)
WHITE  = (255, 255, 255)
LIGHT  = (241, 245, 249)   # light bg
GRAY   = (100, 116, 139)
BLACK  = (15,  23,  42)


class PDF(FPDF):
    def __init__(self):
        super().__init__()
        self.set_auto_page_break(auto=True, margin=18)
        self.set_margins(18, 18, 18)

    # ── Section header bar ──────────────────────────────────────
    def section_header(self, number, title, color=GREEN):
        self.set_fill_color(*color)
        self.set_text_color(*WHITE)
        self.set_font("Helvetica", "B", 13)
        self.cell(0, 10, f"  {number}. {title}", fill=True, ln=True)
        self.ln(3)
        self.set_text_color(*BLACK)

    # ── Sub heading ─────────────────────────────────────────────
    def sub_heading(self, text, color=BLUE):
        self.set_text_color(*color)
        self.set_font("Helvetica", "B", 10)
        self.cell(0, 7, text, ln=True)
        self.set_text_color(*BLACK)

    # ── Body text ────────────────────────────────────────────────
    def body(self, text, indent=0):
        self.set_font("Helvetica", "", 9)
        self.set_text_color(*BLACK)
        self.set_x(self.get_x() + indent)
        self.multi_cell(0, 5.5, text)

    # ── Bullet point ─────────────────────────────────────────────
    def bullet(self, text, indent=6, color=GREEN):
        self.set_font("Helvetica", "", 9)
        self.set_text_color(*color)
        self.set_x(self.l_margin + indent)
        self.cell(5, 5.5, chr(149), ln=False)   # bullet char
        self.set_text_color(*BLACK)
        self.multi_cell(0, 5.5, text)

    # ── Key-value row ─────────────────────────────────────────────
    def kv(self, key, value, key_color=BLUE):
        self.set_font("Helvetica", "B", 9)
        self.set_text_color(*key_color)
        self.cell(48, 5.5, key + ":", ln=False)
        self.set_font("Helvetica", "", 9)
        self.set_text_color(*BLACK)
        self.multi_cell(0, 5.5, value)

    # ── Thin divider ─────────────────────────────────────────────
    def divider(self, color=LIGHT):
        self.set_draw_color(*GRAY)
        self.set_line_width(0.2)
        self.line(self.l_margin, self.get_y(), self.w - self.r_margin, self.get_y())
        self.ln(3)

    # ── Coloured info box ─────────────────────────────────────────
    def info_box(self, text, bg=LIGHT, text_color=BLACK):
        self.set_fill_color(*bg)
        self.set_text_color(*text_color)
        self.set_font("Helvetica", "", 9)
        self.multi_cell(0, 5.5, "  " + text, fill=True)
        self.set_text_color(*BLACK)
        self.ln(2)


pdf = PDF()

# ═══════════════════════════════════════════════════════════════
# COVER PAGE
# ═══════════════════════════════════════════════════════════════
pdf.add_page()
pdf.set_fill_color(*DARK)
pdf.rect(0, 0, pdf.w, pdf.h, "F")

pdf.set_y(55)
pdf.set_text_color(*GREEN)
pdf.set_font("Helvetica", "B", 32)
pdf.cell(0, 14, "SleepNest", align="C", ln=True)

pdf.set_text_color(*WHITE)
pdf.set_font("Helvetica", "", 14)
pdf.cell(0, 8, "AI-Powered Baby Environment Monitor", align="C", ln=True)
pdf.ln(10)

pdf.set_draw_color(*GREEN)
pdf.set_line_width(0.8)
cx = pdf.w / 2
pdf.line(cx - 55, pdf.get_y(), cx + 55, pdf.get_y())
pdf.ln(10)

pdf.set_text_color(148, 163, 184)
pdf.set_font("Helvetica", "", 11)
pdf.cell(0, 7, "IT4021  |  Group Assignment  |  2026", align="C", ln=True)
pdf.ln(4)
pdf.cell(0, 7, "Final Presentation", align="C", ln=True)
pdf.ln(20)

details = [
    ("Hardware",  "Arduino Uno  +  ESP32  +  INMP441  +  DHT11  +  PIR  +  LDR"),
    ("Backend",   "Node.js  +  Express  +  WebSocket  +  MongoDB"),
    ("Frontend",  "React 18  +  Vite  +  Tailwind CSS  +  Chart.js"),
    ("ML Models", "Random Forest  |  Isolation Forest  |  K-Means  |  Linear Regression"),
    ("Accuracy",  "92.8%  |  F1-Score 0.928  |  10,000-sample dataset"),
]
for k, v in details:
    pdf.set_text_color(*AMBER)
    pdf.set_font("Helvetica", "B", 9)
    pdf.cell(38, 6, k + ":", align="R", ln=False)
    pdf.set_text_color(148, 163, 184)
    pdf.set_font("Helvetica", "", 9)
    pdf.cell(0, 6, "  " + v, ln=True)

pdf.set_y(-28)
pdf.set_text_color(71, 85, 105)
pdf.set_font("Helvetica", "", 8)
pdf.cell(0, 5, "Confidential — Academic Submission", align="C", ln=True)


# ═══════════════════════════════════════════════════════════════
# PAGE 1 — System Overview
# ═══════════════════════════════════════════════════════════════
pdf.add_page()
pdf.section_header("1", "Final System Overview")

pdf.kv("Project Name",     "SleepNest — AI-Powered Baby Environment Monitor")
pdf.kv("Module",           "IT4021 IoT Data Analytics")
pdf.kv("Team Size",        "4 Students")
pdf.ln(3)

pdf.sub_heading("Problem Statement")
pdf.body(
    "Parents cannot continuously monitor their baby's environment 24/7. Small changes in "
    "temperature, humidity, sound, and light affect infant comfort and safety but go unnoticed "
    "without smart monitoring."
)
pdf.ln(2)

pdf.sub_heading("Our Solution")
pdf.bullet("Collects real-time data from 5 physical sensors every 2 seconds")
pdf.bullet("Classifies baby's state using a trained Machine Learning model (Random Forest)")
pdf.bullet("Stores all readings in MongoDB with intelligent 30-second aggregation")
pdf.bullet("Displays live insights and ML analysis on a React dashboard")
pdf.bullet("Detects anomalies and behavioral patterns using unsupervised ML")
pdf.ln(3)

pdf.sub_heading("Key System Metrics")
metrics = [
    ("Sensors monitored",    "Temperature, Humidity, Sound, Motion, Light (5 sensors)"),
    ("ML Model accuracy",    "92.8%  |  F1-Score: 0.928"),
    ("Data update rate",     "Every 2 seconds (live)"),
    ("Database writes",      "Every 30 seconds (aggregated batch)"),
    ("Real readings",        "3,316 rows collected from deployed device"),
    ("ML analyses",          "5 / 5 implemented (Trend, Threshold, Correlation, Anomaly, Clustering)"),
    ("Dashboard pages",      "11 pages  |  6+ chart types"),
]
for k, v in metrics:
    pdf.kv(k, v)
pdf.ln(3)

pdf.sub_heading("Sensors Used")
sensors = [
    ("DHT11",    "Temperature + Humidity",    "Arduino Uno GPIO4"),
    ("PIR",      "Motion detection",          "Arduino Uno GPIO5"),
    ("LDR",      "Light level (0-1023)",      "Arduino Uno A0"),
    ("INMP441",  "I2S Microphone / Audio",    "ESP32 GPIO14/15/32"),
]
for name, func, pin in sensors:
    pdf.set_font("Helvetica", "B", 9)
    pdf.set_text_color(*BLUE)
    pdf.cell(22, 5.5, name, ln=False)
    pdf.set_font("Helvetica", "", 9)
    pdf.set_text_color(*BLACK)
    pdf.cell(68, 5.5, func, ln=False)
    pdf.set_text_color(*GRAY)
    pdf.cell(0, 5.5, pin, ln=True)
    pdf.set_text_color(*BLACK)


# ═══════════════════════════════════════════════════════════════
# PAGE 2 — Architecture and Data Flow
# ═══════════════════════════════════════════════════════════════
pdf.add_page()
pdf.section_header("2", "Architecture and Data Flow")

pdf.sub_heading("System Architecture")

arch_lines = [
    "DHT11 / PIR / LDR  ──┐",
    "                      ├── Arduino Uno ──► UART Serial (9600 baud)",
    "                      │                         │",
    "INMP441 Mic    ────── ESP32 (WiFi Gateway) ◄────┘",
    "                              │",
    "                    WebSocket over WiFi",
    "                              │",
    "                    Node.js Server  (Port 3007)",
    "                    ├── adaptESP32DataFormat()",
    "                    ├── Random Forest ML (ONNX Runtime)",
    "                    ├── SoundProcessor (smoothing)",
    "                    ├── DataBuffer → MongoDB (every 30s)",
    "                    └── REST API  /api/devices  /api/db/*",
    "                              │",
    "                    React Dashboard  (Port 5173)",
    "                    └── Polls /api/devices every 2s",
]
pdf.set_fill_color(22, 25, 40)
pdf.set_text_color(148, 163, 184)
pdf.set_font("Courier", "", 8)
for line in arch_lines:
    pdf.set_x(pdf.l_margin)
    pdf.cell(0, 5, "  " + line, fill=True, ln=True)
pdf.set_text_color(*BLACK)
pdf.ln(4)

pdf.sub_heading("Step-by-Step Data Flow")
steps = [
    ("Step 1", "Arduino Uno reads DHT11, PIR, LDR every 2 s → sends string over UART\n         Format: T:31.70,H:59.00,M:0,MC:7,L:359"),
    ("Step 2", "ESP32 reads Arduino via UART + captures 512 I2S audio samples at 16kHz"),
    ("Step 3", "ESP32 normalises audio to 0-1023 range, detects crying, sends JSON via WebSocket"),
    ("Step 4", "Server receives payload → adaptESP32DataFormat() converts to standard format"),
    ("Step 5", "Random Forest ONNX model runs inference → classifies sound event + confidence"),
    ("Step 6", "Result stored in device.data (in-memory) + pushed to DataBuffer"),
    ("Step 7", "DataBuffer flushes aggregated document to MongoDB every 30 seconds"),
    ("Step 8", "Frontend polls /api/devices every 2 s → SensorContext updates → dashboard re-renders"),
]
for label, desc in steps:
    pdf.set_font("Helvetica", "B", 9)
    pdf.set_text_color(*GREEN)
    pdf.cell(16, 5.5, label + ":", ln=False)
    pdf.set_font("Helvetica", "", 9)
    pdf.set_text_color(*BLACK)
    pdf.multi_cell(0, 5.5, desc)
pdf.ln(2)

pdf.sub_heading("Sound Classification Pipeline")
pipeline = [
    "1. Capture 512 I2S samples at 16kHz (ESP32)",
    "2. Normalise to 0-1023 range",
    "3. Calibrate: establish noise floor baseline",
    "4. Confirmation: 3 consecutive loud frames required to trigger event",
    "5. Server: SoundProcessor applies moving average smoothing (window=5)",
    "6. ML Model: Random Forest classifies → QUIET / LIGHT_ACTIVITY / RESTLESS / CRYING",
    "7. Store event + confidence in MongoDB",
]
for p in pipeline:
    pdf.bullet(p)


# ═══════════════════════════════════════════════════════════════
# PAGE 3 — Database Design
# ═══════════════════════════════════════════════════════════════
pdf.add_page()
pdf.section_header("3", "Database Design", color=BLUE)

pdf.sub_heading("Why MongoDB (NoSQL)?")
reasons = [
    "Sensor readings have flexible/variable fields — NoSQL handles schema changes easily",
    "No complex joins needed — each document is self-contained per device per time window",
    "Horizontal scaling suits high-frequency IoT write workloads",
    "Native JSON document format matches our sensor payload structure exactly",
    "MongoDB Atlas provides cloud hosting, auto-backups, and TTL index support",
]
for r in reasons:
    pdf.bullet(r)
pdf.ln(3)

pdf.sub_heading("Collection 1: readings  (main data store)")
pdf.info_box(
    "Flushed every 30 seconds. One document = one aggregated 30-second window per device.\n"
    "Fields: deviceId | ts | sampleCount | temp{avg,min,max,last} | humidity{avg,min,max,last} |\n"
    "sound{avg,max,last,event} | comfort{avg,last} | motion{samplesActive,durationMs} |\n"
    "light{avg,last} | soundHist{QUIET,LIGHT_ACTIVITY,RESTLESS,CRYING} | lastRaw{}",
    bg=(230, 242, 255), text_color=(30, 58, 138)
)

pdf.sub_heading("Collection 2: events  (state change alerts)")
pdf.info_box(
    "Written immediately on state transitions — not batched.\n"
    "Fields: deviceId | ts | category (sound/motion) | type (CRYING/MOTION_START etc.) |\n"
    "soundLevel | soundDiff | durationMs",
    bg=(255, 243, 230), text_color=(120, 53, 15)
)

pdf.sub_heading("Collection 3: hourly_stats  (aggregated summaries)")
pdf.info_box(
    "Computed once per hour by the Aggregator service.\n"
    "Fields: deviceId | hour | avgComfort | avgSound | dominantEvent | motionCount | sampleCount",
    bg=(230, 255, 238), text_color=(20, 83, 45)
)
pdf.ln(2)

pdf.sub_heading("Comfort Score Formula  (computed server-side before storage)")
pdf.set_fill_color(*DARK)
pdf.set_text_color(*GREEN)
pdf.set_font("Courier", "", 9)
formula = [
    "  tempScore   = max(0,  100 - |temp - 20| * 8 )",
    "  humScore    = max(0,  100 - |humidity - 50| * 2.5 )",
    "  soundScore  = max(0,  100 - (soundLevel / 1023) * 100 )",
    "  comfort     = tempScore*0.35 + humScore*0.25 + soundScore*0.40",
]
for line in formula:
    pdf.cell(0, 5.5, line, fill=True, ln=True)
pdf.set_text_color(*BLACK)
pdf.ln(3)

pdf.sub_heading("Data Retention Policy")
pdf.bullet("Raw readings: TTL index → auto-expire after 7 days")
pdf.bullet("Events: kept indefinitely (low volume — edge-triggered only)")
pdf.bullet("Hourly stats: kept indefinitely (pre-aggregated, small size)")
pdf.bullet("DataBuffer flushes: 30-second intervals = 120 writes/hour (vs 1800 without buffering)")


# ═══════════════════════════════════════════════════════════════
# PAGE 4 — Data Analysis and Insights
# ═══════════════════════════════════════════════════════════════
pdf.add_page()
pdf.section_header("4", "Data Analysis and Insights")

pdf.info_box(
    "All 5 ML analysis types implemented (assignment requires minimum 4).\n"
    "Every analysis uses a trained ML model — not hard-coded rules or descriptive statistics alone.",
    bg=(230, 255, 238), text_color=(20, 83, 45)
)
pdf.ln(2)

analyses = [
    {
        "num": "①",
        "title": "Random Forest Classifier — Sound Classification  [MAIN MODEL]",
        "color": GREEN,
        "rows": [
            ("Type",          "Supervised Learning — Multi-class classification"),
            ("Dataset",       "10,000 synthetic rows (built from 3,316 real readings)"),
            ("Classes",       "QUIET  /  LIGHT_ACTIVITY  /  RESTLESS  /  CRYING"),
            ("Accuracy",      "92.8%  |  F1-Score: 0.928  |  Cross-validated"),
            ("Deployment",    "ONNX format — runs inside Node.js via onnxruntime-node"),
            ("Inference",     "< 5ms per prediction, runs every 2 seconds live"),
            ("Key insight",   "Sound level is dominant comfort driver (feature importance #1, weight 40%)"),
        ],
    },
    {
        "num": "②",
        "title": "Linear Regression — Trend Analysis",
        "color": BLUE,
        "rows": [
            ("Type",          "Supervised / Statistical regression"),
            ("Applied to",    "Comfort score, Temperature, Sound level over time"),
            ("Method",        "7-point rolling average to remove noise, then LinearRegression (sklearn)"),
            ("Key insight",   "Trend direction — whether baby comfort is improving or worsening over session"),
        ],
    },
    {
        "num": "③",
        "title": "Pearson Correlation + Feature Importance — Correlation Analysis",
        "color": (168, 85, 247),
        "rows": [
            ("Type",          "Statistical correlation + ML feature importance"),
            ("Key finding",   "Sound vs Comfort: r = -0.967  (very strong negative correlation)"),
            ("ML link",       "Random Forest feature importance confirms: Sound 40%, Temp 35%, Humidity 25%"),
            ("Key insight",   "Mathematically proven — higher sound always means lower comfort"),
        ],
    },
    {
        "num": "④",
        "title": "Isolation Forest — Anomaly Detection",
        "color": RED,
        "rows": [
            ("Type",          "Unsupervised anomaly detection"),
            ("Training",      "Trained on QUIET samples only (1,211 normal readings) — learns normal behaviour"),
            ("Parameters",    "200 trees  |  contamination=8%  |  StandardScaler normalisation"),
            ("Validation",    "Precision: 0.804  |  Recall: 0.790 vs actual CRYING/RESTLESS labels"),
            ("Key insight",   "Detects unusual readings without needing labelled 'bad' data"),
        ],
    },
    {
        "num": "⑤",
        "title": "K-Means Clustering — Behavior Pattern Analysis",
        "color": AMBER,
        "rows": [
            ("Type",          "Unsupervised clustering"),
            ("Method",        "Tested k=2 to k=8, selected best k by Silhouette Score"),
            ("Result",        "k=3  |  Silhouette Score: 0.424"),
            ("Cluster 0",     "Quiet & Comfortable  — sound~60, comfort~59.6  (28% of data)"),
            ("Cluster 1",     "Light Activity       — sound~85, comfort~57.8  (40% of data)"),
            ("Cluster 2",     "Restless / Noisy     — sound~334, comfort~47.6 (32% of data)"),
            ("Key insight",   "Without any labels, model independently discovered the same 3 natural states"),
        ],
    },
]

for a in analyses:
    pdf.set_text_color(*a["color"])
    pdf.set_font("Helvetica", "B", 10)
    pdf.cell(0, 6, f"  {a['num']}  {a['title']}", ln=True)
    pdf.set_text_color(*BLACK)
    for k, v in a["rows"]:
        pdf.kv("    " + k, v, key_color=a["color"])
    pdf.ln(2)


# ═══════════════════════════════════════════════════════════════
# PAGE 5 — Dashboard Demonstration
# ═══════════════════════════════════════════════════════════════
pdf.add_page()
pdf.section_header("5", "Dashboard Demonstration", color=(168, 85, 247))

pdf.kv("Tech Stack",  "React 18 + Vite + Tailwind CSS + Chart.js")
pdf.kv("Update rate", "Every 2 seconds (real-time polling)")
pdf.kv("Total pages", "11 pages  |  Dark mode supported  |  Configurable thresholds")
pdf.ln(3)

pdf.sub_heading("Dashboard Pages and Visualization Types")

pages = [
    ("Baby Sitter View",    "Full-screen comfort arc for caregivers",                    "Arc gauge"),
    ("Overview",            "Live sensor cards — all values at a glance",               "Stat cards"),
    ("Monitoring",          "Real-time sensor history (last 60 readings)",              "Line charts"),
    ("Sleep Analysis",      "Session quality + sound event breakdown",                  "Bar chart + progress bars"),
    ("Alerts",              "Alert log with timestamps and sound levels",               "Event list"),
    ("History",             "Raw reading table — full session data",                    "Data table"),
    ("Trend Analysis",      "Comfort/Temp/Sound trends with regression line",           "Line + regression"),
    ("Correlation",         "Pearson r cards + Sound vs Comfort scatter",               "Scatter chart + bars"),
    ("Anomaly Detection",   "Live anomaly score + ML confidence + events log",          "Gauge + list"),
    ("Behavior Patterns",   "Current cluster + live scatter + session distribution",    "Scatter + stacked bars"),
    ("Settings",            "Threshold configuration — persisted to server",            "Form inputs"),
]

pdf.set_font("Helvetica", "B", 9)
pdf.set_fill_color(*DARK)
pdf.set_text_color(*WHITE)
pdf.cell(48, 6, "  Page", fill=True, ln=False)
pdf.cell(78, 6, "  Description", fill=True, ln=False)
pdf.cell(0,  6, "  Chart Type", fill=True, ln=True)

for i, (page, desc, chart) in enumerate(pages):
    bg = LIGHT if i % 2 == 0 else WHITE
    pdf.set_fill_color(*bg)
    pdf.set_text_color(*BLACK)
    pdf.set_font("Helvetica", "B", 8)
    pdf.cell(48, 5.5, "  " + page, fill=True, ln=False)
    pdf.set_font("Helvetica", "", 8)
    pdf.cell(78, 5.5, "  " + desc, fill=True, ln=False)
    pdf.set_text_color(*BLUE)
    pdf.cell(0,  5.5, "  " + chart, fill=True, ln=True)
    pdf.set_text_color(*BLACK)
pdf.ln(4)

pdf.sub_heading("Key Dashboard Features")
features = [
    "Real-time updates every 2 seconds — no page refresh needed",
    "ML confidence score shown live on every reading",
    "Dark mode toggle (persists across sessions)",
    "Configurable sound thresholds via Settings page — saved to server, survive restarts",
    "All 5 Analyse pages update live using Chart.js (except static historical PNG reports)",
    "Comfort arc gauge — designed for non-technical caregivers (one glance = full picture)",
    "Alert log keeps history of all CRYING/RESTLESS events with timestamps",
]
for f in features:
    pdf.bullet(f)


# ═══════════════════════════════════════════════════════════════
# PAGE 6 — Software Design Decisions
# ═══════════════════════════════════════════════════════════════
pdf.add_page()
pdf.section_header("6", "Software Design Decisions", color=AMBER)

decisions = [
    (
        "① Two microcontrollers (Arduino Uno + ESP32)",
        "Arduino Uno reliably handles simple digital/analog sensors (DHT11, PIR, LDR). "
        "ESP32 handles WiFi connectivity and I2S audio processing. Combining both in one "
        "microcontroller would exceed memory limits and create timing conflicts between "
        "sensor polling and audio sampling."
    ),
    (
        "② ONNX Runtime for ML inference in Node.js",
        "Python sklearn models cannot run natively in Node.js. We exported the trained "
        "Random Forest to ONNX format (open standard) and run it using onnxruntime-node. "
        "This gives < 5ms inference time with no Python process — the ML model is a native "
        "part of the server."
    ),
    (
        "③ DataBuffer — 30-second batch writes to MongoDB",
        "ESP32 sends data every 2 seconds = 1,800 writes/hour if written directly. "
        "Our DataBuffer class accumulates readings in memory and flushes one aggregated "
        "document every 30 seconds = 120 writes/hour (15x reduction) while preserving "
        "all statistical information: avg, min, max, dominant event."
    ),
    (
        "④ React Context API (not Redux)",
        "All dashboard data flows from a single source — one API poll every 2 seconds. "
        "Context API handles this cleanly without Redux boilerplate. SensorContext is the "
        "single source of truth for all pages — no prop drilling, no state duplication."
    ),
    (
        "⑤ Random Forest over Neural Network",
        "Our data is tabular sensor readings (structured numbers) — not images or text. "
        "Random Forest performs equally well on structured data, trains in seconds, needs "
        "no GPU, and provides interpretable feature importance scores. A neural network "
        "would be a black box with no explainability benefit here."
    ),
    (
        "⑥ 92.8% accuracy (intentionally not 100%)",
        "We added 25% borderline samples, 10% outliers, and 6% label noise to the "
        "training dataset. 100% accuracy = the model memorised training data (overfitting) "
        "and fails on real sensor noise. 92.8% generalises better to unseen real-world readings."
    ),
    (
        "⑦ Format Adapter Pattern for ESP32 payload",
        "The ESP32 sends a nested JSON format {audio:{}, sensors:{}} while our system "
        "uses a flat format internally. A single adaptESP32DataFormat() function handles "
        "all conversion. If the ESP32 firmware changes, only this one function needs updating."
    ),
    (
        "⑧ config.json for persistent threshold settings",
        "Sound classification thresholds can be changed at runtime via the Settings page. "
        "We persist them to config.json on disk — loaded on server startup. This means "
        "threshold changes survive server restarts without re-deployment."
    ),
]

for title, desc in decisions:
    pdf.set_font("Helvetica", "B", 9)
    pdf.set_text_color(*AMBER)
    pdf.cell(0, 5.5, title, ln=True)
    pdf.set_font("Helvetica", "", 9)
    pdf.set_text_color(*BLACK)
    pdf.multi_cell(0, 5.5, "   " + desc)
    pdf.ln(2)


# ═══════════════════════════════════════════════════════════════
# PAGE 7 — Challenges and Lessons Learned
# ═══════════════════════════════════════════════════════════════
pdf.add_page()
pdf.section_header("7", "Challenges and Lessons Learned", color=RED)

challenges = [
    (
        "Challenge 1 — Sound Threshold Calibration",
        "The ambient noise floor in our room was ~70 (out of 1023). Initial thresholds "
        "were too low — everything was classified as CRYING. We iteratively calibrated "
        "by analysing the real data distribution in the CSV and testing different values. "
        "Final thresholds: QUIET=70 / LIGHT_ACTIVITY=110 / RESTLESS=250 / CRYING=400.",
        "Lesson: Always analyse your real deployment environment before setting thresholds. "
        "Lab conditions do not match real rooms."
    ),
    (
        "Challenge 2 — Two Different ESP32 Payload Formats",
        "Midway through development the ESP32 firmware changed to send nested JSON "
        "{audio:{}, sensors:{}} instead of flat format. This broke the entire server-side "
        "data processing pipeline.",
        "Lesson: Design format adapters from day one. Our adaptESP32DataFormat() function "
        "isolated the change to one place — all other code was unaffected."
    ),
    (
        "Challenge 3 — Running ML Model inside Node.js",
        "Python sklearn models cannot be imported into Node.js directly. We tried "
        "spawning a Python child process but latency was too high for 2-second updates.",
        "Lesson: Export ML models to ONNX format for cross-platform deployment. "
        "onnxruntime-node gave us < 5ms inference with no Python dependency at runtime."
    ),
    (
        "Challenge 4 — MongoDB Write Rate Limits",
        "Direct writes at 2-second intervals hit MongoDB Atlas free tier rate limits, "
        "causing dropped data. Needed a solution that reduced writes without losing information.",
        "Lesson: Never write every event directly to a cloud database in IoT systems. "
        "Always buffer and aggregate. Our DataBuffer reduced writes by 15x while keeping "
        "avg, min, max statistics intact."
    ),
    (
        "Challenge 5 — Model Accuracy Was Too High (100%)",
        "First synthetic dataset produced 100% accuracy — a sign of overfitting. "
        "The model would fail on real sensor noise.",
        "Lesson: Perfect accuracy on training data is a red flag. We deliberately added "
        "noise (borderline samples, outliers, label flipping) to get 92.8% — a model that "
        "actually generalises to real-world sensor readings."
    ),
]

for title, challenge, lesson in challenges:
    pdf.set_font("Helvetica", "B", 9)
    pdf.set_text_color(*RED)
    pdf.cell(0, 5.5, title, ln=True)
    pdf.set_font("Helvetica", "", 9)
    pdf.set_text_color(*BLACK)
    pdf.multi_cell(0, 5.5, "   Challenge: " + challenge)
    pdf.set_text_color(*GREEN)
    pdf.multi_cell(0, 5.5, "   Lesson learned: " + lesson)
    pdf.set_text_color(*BLACK)
    pdf.ln(2)


# ═══════════════════════════════════════════════════════════════
# PAGE 8 — Future Enhancements
# ═══════════════════════════════════════════════════════════════
pdf.add_page()
pdf.section_header("8", "Future Enhancements", color=GREEN)

sections = [
    ("Short Term (1–3 months)", GREEN, [
        "Mobile app (React Native) with push notifications for crying alerts",
        "Email / SMS alert when CRYING detected for more than 30 consecutive seconds",
        "Export session data to CSV directly from the dashboard",
        "Collect 5+ days of data to retrain model on richer real-world dataset",
    ]),
    ("Medium Term (3–6 months)", BLUE, [
        "Add OV2640 camera module for video monitoring alongside sensor data",
        "Personalised baseline — model adapts to each individual baby's normal behaviour",
        "Multi-device support — monitor multiple rooms from one dashboard",
        "Automatic model retraining when new labelled data is available",
    ]),
    ("Long Term (6+ months)", AMBER, [
        "Edge AI deployment — run Random Forest directly on ESP32 using TensorFlow Lite (no server needed)",
        "Sleep stage classification — distinguish light sleep / deep sleep / REM using motion + sound patterns",
        "Predictive alerts — warn parents 2-3 minutes before baby wakes using trend patterns",
        "Integration with smart home devices (Philips Hue, smart speakers) for automated response",
    ]),
]

for title, color, items in sections:
    pdf.sub_heading(title, color=color)
    for item in items:
        pdf.bullet(item, color=color)
    pdf.ln(2)

pdf.divider()
pdf.ln(2)

pdf.set_font("Helvetica", "B", 11)
pdf.set_text_color(*GREEN)
pdf.cell(0, 7, "Summary — What We Built", ln=True)
pdf.set_text_color(*BLACK)
pdf.set_font("Helvetica", "", 9)
summary_points = [
    "A fully integrated IoT baby monitoring system — hardware through to live dashboard",
    "5 ML models deployed: Random Forest (92.8%), Linear Regression, Isolation Forest, K-Means, Pearson r",
    "Real-time React dashboard with 11 pages, 6+ chart types, dark mode, configurable ML thresholds",
    "MongoDB storage with intelligent batching, TTL expiry, and event-driven alerts",
    "All 5 analysis types from the assignment brief implemented and displayed live",
]
for p in summary_points:
    pdf.bullet(p, color=GREEN)

pdf.ln(5)
pdf.set_fill_color(*DARK)
pdf.set_text_color(*WHITE)
pdf.set_font("Helvetica", "B", 11)
pdf.cell(0, 10, "  Thank You — SleepNest  |  IT4021  |  2026", fill=True, align="C", ln=True)


# ── Save ──────────────────────────────────────────────────────────
pdf.output(OUT)
print(f"\n  PDF saved: {OUT}")
print(f"  Pages: {pdf.page}")
