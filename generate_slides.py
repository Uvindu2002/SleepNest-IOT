"""
SleepNest — Presentation Slide Generator
Generates 8 PNG slides (1920x1080) for the final presentation.
"""

import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
import matplotlib.patches as mpatches
from matplotlib.patches import FancyBboxPatch, FancyArrowPatch
import numpy as np
import os

OUT = "slides"
os.makedirs(OUT, exist_ok=True)

# ── Palette ───────────────────────────────────────────────────────
BG     = "#0F1117"
CARD   = "#1E2236"
CARD2  = "#252A40"
BORDER = "#2A2E4A"
GREEN  = "#3B9E72"
BLUE   = "#5A52E0"
AMBER  = "#F59E0B"
RED    = "#EF4444"
PURPLE = "#A855F7"
TEXT   = "#E2E8F0"
SUB    = "#94A3B8"
WHITE  = "#FFFFFF"

W, H = 16, 9   # inches at 120 dpi → 1920x1080

def fig():
    f = plt.figure(figsize=(W, H), facecolor=BG)
    f.patch.set_facecolor(BG)
    return f

def ax_full(f):
    a = f.add_axes([0, 0, 1, 1])
    a.set_xlim(0, W); a.set_ylim(0, H)
    a.axis('off'); a.set_facecolor(BG)
    return a

def card(ax, x, y, w, h, color=CARD, border=BORDER, radius=0.2, lw=1.5):
    ax.add_patch(FancyBboxPatch((x, y), w, h,
        boxstyle=f"round,pad=0,rounding_size={radius}",
        facecolor=color, edgecolor=border, linewidth=lw, zorder=2))

def hline(ax, x, y, w, color=GREEN, lw=3):
    ax.plot([x, x+w], [y, y], color=color, lw=lw, solid_capstyle='round', zorder=3)

def title_slide(ax, main, sub=None, y_main=8.2, size=44):
    ax.text(W/2, y_main, main, color=WHITE, fontsize=size, fontweight='bold',
            ha='center', va='center', zorder=5,
            fontfamily='DejaVu Sans')
    if sub:
        ax.text(W/2, y_main-0.65, sub, color=SUB, fontsize=16,
                ha='center', va='center', zorder=5)

def section_title(ax, text, x=0.5, y=8.35, size=32):
    ax.text(x, y, text, color=WHITE, fontsize=size, fontweight='bold',
            ha='left', va='center', zorder=5)
    hline(ax, x, y-0.4, W-1.0, GREEN, lw=2)

def badge(ax, x, y, w, h, label, value, color=GREEN, text_color=WHITE):
    card(ax, x, y, w, h, CARD2, color, radius=0.18, lw=2)
    ax.text(x+w/2, y+h*0.65, value, color=color, fontsize=22, fontweight='bold',
            ha='center', va='center', zorder=5)
    ax.text(x+w/2, y+h*0.22, label, color=SUB, fontsize=10,
            ha='center', va='center', zorder=5)

def bullet(ax, x, y, text, color=SUB, size=13, indent=0.3):
    ax.text(x, y, '>', color=color, fontsize=size, ha='left', va='top', zorder=5)
    ax.text(x+indent, y, text, color=TEXT, fontsize=size,
            ha='left', va='top', zorder=5, wrap=True)

def arrow(ax, x1, y1, x2, y2, color=GREEN):
    ax.annotate('', xy=(x2, y2), xytext=(x1, y1),
        arrowprops=dict(arrowstyle='->', color=color, lw=2.5),
        zorder=4)

def save(f, name):
    f.savefig(f"{OUT}/{name}", dpi=120, bbox_inches='tight',
              facecolor=BG, edgecolor='none')
    plt.close(f)
    print(f"  Saved: {OUT}/{name}")


# ═══════════════════════════════════════════════════════════════════
# SLIDE 1 — System Overview
# ═══════════════════════════════════════════════════════════════════
print("Generating slide 1...")
f = fig(); ax = ax_full(f)

# Top accent bar
ax.add_patch(plt.Rectangle((0, H-0.18), W, 0.18, color=GREEN, zorder=3))

# Title block
ax.text(W/2, 8.15, 'SleepNest', color=WHITE, fontsize=42, fontweight='bold',
        ha='center', va='center', zorder=5)
ax.text(W/2, 7.55, 'IoT Baby Monitoring System', color=GREEN, fontsize=22,
        fontweight='bold', ha='center', va='center', zorder=5)
ax.text(W/2, 7.1, 'Real-time baby environment monitoring using IoT + Machine Learning',
        color=SUB, fontsize=14, ha='center', va='center', zorder=5)

# 4 stat badges
badges = [
    ('5 Sensors',   '[S]', GREEN),
    ('4 ML Models', '[ML]', BLUE),
    ('92.8%',       '[%]', AMBER),
    ('Real-time',   '[RT]', PURPLE),
]
bw, bh, by = 3.0, 1.1, 5.7
bx0 = 0.5
for i, (label, icon, col) in enumerate(badges):
    bx = bx0 + i*(bw+0.33)
    card(ax, bx, by, bw, bh, CARD2, col, radius=0.2, lw=2)
    ax.text(bx+bw/2, by+bh*0.72, icon, fontsize=22, ha='center', va='center', zorder=5)
    ax.text(bx+bw/2, by+bh*0.35, label, color=col, fontsize=16, fontweight='bold',
            ha='center', va='center', zorder=5)

# Hardware card (left)
card(ax, 0.5, 2.1, 6.8, 3.3, CARD, BORDER, radius=0.2)
ax.text(0.9, 5.1, 'Hardware', color=GREEN, fontsize=15, fontweight='bold',
        va='center', zorder=5)
hw = ['Arduino Uno  — DHT11 · PIR · LDR',
      'ESP32          — INMP441 I2S Mic · WiFi',
      'UART Serial — 9600 baud · every 2s',
      'WebSocket  — ESP32 → Node.js server']
for i, t in enumerate(hw):
    bullet(ax, 0.9, 4.65-i*0.62, t, GREEN, 13)

# Software card (right)
card(ax, 7.7, 2.1, 7.8, 3.3, CARD, BORDER, radius=0.2)
ax.text(8.1, 5.1, 'Software Stack', color=BLUE, fontsize=15, fontweight='bold',
        va='center', zorder=5)
sw = ['Node.js + Express + WebSocket (port 3007)',
      'React 18 + Vite + Tailwind CSS (port 5173)',
      'MongoDB Atlas  — NoSQL cloud database',
      'ONNX Runtime  — ML inference in Node.js']
for i, t in enumerate(sw):
    bullet(ax, 8.1, 4.65-i*0.62, t, BLUE, 13)

# Footer
ax.text(0.5, 0.25, 'IT4021 Group Assignment  ·  Team Size: 4 Students  ·  2026',
        color=SUB, fontsize=11, va='center', zorder=5)
ax.text(W-0.5, 0.25, 'Slide 1 / 8', color=SUB, fontsize=11,
        ha='right', va='center', zorder=5)

save(f, '01_system_overview.png')


# ═══════════════════════════════════════════════════════════════════
# SLIDE 2 — Architecture and Data Flow
# ═══════════════════════════════════════════════════════════════════
print("Generating slide 2...")
f = fig(); ax = ax_full(f)
ax.add_patch(plt.Rectangle((0, H-0.18), W, 0.18, color=BLUE, zorder=3))

section_title(ax, 'System Architecture & Data Flow', 0.5, 8.35, 28)

stages = [
    ('Arduino Uno', '[UNO]', '• DHT11 Temp/Humidity\n• PIR Motion sensor\n• LDR Light sensor\n• UART @ 9600 baud\n• Every 2 seconds', GREEN),
    ('ESP32 Gateway', '[ESP]', '• INMP441 I2S Mic\n• Reads Arduino UART\n• Audio processing\n• WiFi enabled\n• WebSocket client', BLUE),
    ('Node.js Server', '[SVR]', '• Port 3007\n• ONNX ML inference\n• SoundProcessor\n• Buffer → MongoDB\n• REST API + WS', AMBER),
    ('MongoDB Atlas', '[DB]', '• readings collection\n• events collection\n• hourly_stats\n• TTL: 7 days\n• 30s batch flush', RED),
    ('React Dashboard', '[UI]', '• Port 5173\n• Polls /api every 2s\n• 11 pages\n• Chart.js live charts\n• Real-time updates', PURPLE),
]

bw, bh = 2.7, 4.2
by = 2.6
bx0 = 0.35
gap = 0.3

for i, (name, icon, detail, col) in enumerate(stages):
    bx = bx0 + i*(bw+gap)
    card(ax, bx, by, bw, bh, CARD, col, radius=0.2, lw=2)
    ax.text(bx+bw/2, by+bh-0.35, icon, fontsize=20, ha='center', va='center', zorder=5)
    ax.text(bx+bw/2, by+bh-0.78, name, color=col, fontsize=13, fontweight='bold',
            ha='center', va='center', zorder=5)
    hline(ax, bx+0.2, by+bh-1.05, bw-0.4, col, lw=1)
    for j, line in enumerate(detail.split('\n')):
        ax.text(bx+0.22, by+bh-1.35-j*0.52, line, color=TEXT, fontsize=10.5,
                ha='left', va='center', zorder=5)

    # Arrow to next stage
    if i < len(stages)-1:
        ax_arrow = bx+bw+0.02
        ay = by+bh/2
        ax.annotate('', xy=(ax_arrow+gap-0.04, ay), xytext=(ax_arrow+0.04, ay),
            arrowprops=dict(arrowstyle='->', color=col, lw=3), zorder=4)

# ML label under server box
sx = bx0 + 2*(bw+gap)
ax.text(sx+bw/2, by-0.25, '[ML] ML runs here on every reading',
        color=AMBER, fontsize=11, ha='center', va='center', zorder=5,
        fontstyle='italic')

ax.text(0.5, 0.25, 'IT4021 · SleepNest', color=SUB, fontsize=11, va='center', zorder=5)
ax.text(W-0.5, 0.25, 'Slide 2 / 8', color=SUB, fontsize=11, ha='right', va='center', zorder=5)
save(f, '02_architecture.png')


# ═══════════════════════════════════════════════════════════════════
# SLIDE 3 — Database Design
# ═══════════════════════════════════════════════════════════════════
print("Generating slide 3...")
f = fig(); ax = ax_full(f)
ax.add_patch(plt.Rectangle((0, H-0.18), W, 0.18, color=AMBER, zorder=3))

section_title(ax, 'MongoDB Database Design', 0.5, 8.35, 28)

collections = [
    ('readings', GREEN, '30s aggregated batch',
     ['deviceId, ts, sampleCount',
      'temp: { avg, min, max, last }',
      'humidity: { avg, min, max, last }',
      'sound: { avg, max, last, event }',
      'comfort: { avg, last }',
      'motion: { samplesActive, durationMs }',
      'light: { avg, last }',
      'soundHist: { QUIET, LIGHT_ACTIVITY,',
      '             RESTLESS, CRYING }',
      'lastRaw: { full snapshot }'],
     'Main collection · ~15 readings/doc · 120 writes/hr'),
    ('events', BLUE, 'Immediate on state change',
     ['deviceId, ts',
      'category: sound | motion',
      'type: QUIET→CRYING, MOTION_START',
      'soundLevel, soundDiff, dB',
      '',
      'Triggers:',
      '• Sound event escalation',
      '• Motion rising edge',
      '• Motion falling edge'],
     'Edge-triggered · written instantly · low volume'),
    ('hourly_stats', AMBER, 'Aggregated every hour',
     ['deviceId, hour (UTC bucket)',
      'avgTemp, avgHumidity',
      'avgSound, peakSound',
      'avgComfort',
      'eventCounts: { QUIET, CRYING... }',
      'motionEvents',
      '',
      'TTL: 7 days (auto-deleted)',
      ''],
     'Used for trend & pattern analysis'),
]

cw, ch = 4.6, 5.2
cy = 1.9
cx0 = 0.45
cgap = 0.45

for i, (name, col, tagline, fields, note) in enumerate(collections):
    cx = cx0 + i*(cw+cgap)
    card(ax, cx, cy, cw, ch, CARD, col, radius=0.2, lw=2)
    # Header
    ax.add_patch(FancyBboxPatch((cx, cy+ch-0.85), cw, 0.85,
        boxstyle='round,pad=0,rounding_size=0.2',
        facecolor=col+'33', edgecolor='none', zorder=3))
    ax.text(cx+cw/2, cy+ch-0.43, name, color=col, fontsize=16, fontweight='bold',
            ha='center', va='center', zorder=5)
    ax.text(cx+cw/2, cy+ch-0.75, tagline, color=col+'CC', fontsize=9,
            ha='center', va='center', zorder=5)
    # Fields
    for j, f_text in enumerate(fields):
        if f_text == '':
            continue
        prefix = '  ' if f_text.startswith(' ') else ''
        ax.text(cx+0.25, cy+ch-1.25-j*0.38, f_text, color=TEXT if not f_text.endswith(':') else col,
                fontsize=10, ha='left', va='center', zorder=5,
                fontweight='bold' if f_text.endswith(':') else 'normal',
                fontfamily='monospace')
    # Note
    ax.text(cx+cw/2, cy+0.22, note, color=SUB, fontsize=9,
            ha='center', va='center', zorder=5, fontstyle='italic')

# Why MongoDB box
card(ax, 0.45, 0.55, W-0.9, 0.9, CARD2, GREEN, radius=0.15, lw=1.5)
ax.text(0.85, 1.0, 'Why MongoDB:', color=GREEN, fontsize=12, fontweight='bold',
        va='center', zorder=5)
reasons = 'Schema-flexible (sensors can change)   ·   Fast writes for IoT streaming   ·   TTL auto-cleanup   ·   JSON-native for Node.js   ·   Atlas free tier'
ax.text(4.2, 1.0, reasons, color=TEXT, fontsize=11, va='center', zorder=5)

ax.text(0.5, 0.22, 'IT4021 · SleepNest', color=SUB, fontsize=11, va='center', zorder=5)
ax.text(W-0.5, 0.22, 'Slide 3 / 8', color=SUB, fontsize=11, ha='right', va='center', zorder=5)
save(f, '03_database_design.png')


# ═══════════════════════════════════════════════════════════════════
# SLIDE 4 — Data Analysis & Insights
# ═══════════════════════════════════════════════════════════════════
print("Generating slide 4...")
f = fig(); ax = ax_full(f)
ax.add_patch(plt.Rectangle((0, H-0.18), W, 0.18, color=PURPLE, zorder=3))

section_title(ax, '[ML]  ML Models & Data Analysis', 0.5, 8.35, 28)

models = [
    ('Random Forest Classifier', 'Supervised', GREEN, BLUE,
     ['Purpose: Classify QUIET / LIGHT_ACTIVITY / RESTLESS / CRYING',
      'Data: 10,000 synthetic + 3,316 real sensor rows',
      'Accuracy: 92.8%   ·   F1 Score: 0.928',
      'Runs live via ONNX every 2 seconds in Node.js',
      'Features: sound, temp, humidity, light, comfort, motion']),
    ('Isolation Forest', 'Unsupervised · Anomaly', RED, AMBER,
     ['Purpose: Detect abnormal readings without labels',
      'Trained on 1,211 QUIET (normal) samples only',
      'Precision: 0.804   ·   Recall: 0.790',
      'Contamination: 8%   ·   Trees: 200',
      'Flags CRYING/RESTLESS as anomalous automatically']),
    ('K-Means Clustering', 'Unsupervised · Patterns', AMBER, GREEN,
     ['Purpose: Discover natural baby behaviour states',
      'Optimal k=3 via Elbow + Silhouette Score (0.424)',
      'Cluster 0: Quiet & Comfortable  (sound ~60, comfort 59.6)',
      'Cluster 1: Light Activity          (sound ~85, comfort 57.8)',
      'Cluster 2: Restless / Noisy      (sound ~334, comfort 47.6)']),
    ('Linear Regression', 'Trend Analysis', BLUE, PURPLE,
     ['Purpose: Show if comfort/temp/sound improving or worsening',
      '7-point rolling average applied first to reduce noise',
      'Regression line slope = trend direction (↑ ↓ →)',
      'Live in dashboard — recalculates every 2 seconds',
      'Applied to: Comfort Score · Temperature · Sound Level']),
]

mw, mh = 7.3, 3.35
mx_list = [0.4, 8.3]
my_list = [4.45, 0.85]

for i, (name, mtype, col, col2, points) in enumerate(models):
    mx = mx_list[i % 2]
    my = my_list[i // 2]
    card(ax, mx, my, mw, mh, CARD, col, radius=0.2, lw=2)
    # Top stripe
    ax.add_patch(FancyBboxPatch((mx, my+mh-0.9), mw, 0.9,
        boxstyle='round,pad=0,rounding_size=0.2',
        facecolor=col+'22', edgecolor='none', zorder=3))
    ax.text(mx+0.3, my+mh-0.35, name, color=col, fontsize=14, fontweight='bold',
            va='center', zorder=5)
    # Type badge
    ax.add_patch(FancyBboxPatch((mx+mw-2.6, my+mh-0.72), 2.4, 0.44,
        boxstyle='round,pad=0,rounding_size=0.1',
        facecolor=col2+'33', edgecolor=col2, linewidth=1, zorder=4))
    ax.text(mx+mw-1.4, my+mh-0.5, mtype, color=col2, fontsize=9, fontweight='bold',
            ha='center', va='center', zorder=5)
    # Bullet points
    for j, pt in enumerate(points):
        ax.text(mx+0.25, my+mh-1.2-j*0.46, '> '+pt, color=TEXT, fontsize=11,
                ha='left', va='center', zorder=5)

ax.text(0.5, 0.22, 'IT4021 · SleepNest', color=SUB, fontsize=11, va='center', zorder=5)
ax.text(W-0.5, 0.22, 'Slide 4 / 8', color=SUB, fontsize=11, ha='right', va='center', zorder=5)
save(f, '04_data_analysis.png')


# ═══════════════════════════════════════════════════════════════════
# SLIDE 5 — Dashboard Demonstration
# ═══════════════════════════════════════════════════════════════════
print("Generating slide 5...")
f = fig(); ax = ax_full(f)
ax.add_patch(plt.Rectangle((0, H-0.18), W, 0.18, color=GREEN, zorder=3))

section_title(ax, 'Interactive Dashboard — 11 Pages', 0.5, 8.35, 28)

pages = [
    ('️', 'Baby Sitter View',   'Full-screen comfort arc · default landing',       GREEN),
    ('', 'Overview',           'Real-time sensor cards · comfort score · status',  BLUE),
    ('', 'Monitoring',         'Live Chart.js line charts · temp/sound/motion',    PURPLE),
    ('', 'Sleep Analysis',     'Sleep quality score · sound distribution bar',     AMBER),
    ('', 'Alerts',             'Alert log · CRYING/RESTLESS events timestamped',   RED),
    ('', 'History',            'Full session data table · 500 readings',           SUB),
    ('️', 'Settings',           'ML threshold config · persisted to config.json',   GREEN),
    ('', 'Trend Analysis',     'Live regression · rolling avg · 3 line charts',    BLUE),
    ('', 'Correlation',        'Live Pearson r · scatter plot by ML class',        PURPLE),
    ('', 'Anomaly Detection',  'Live anomaly score gauge · ML status · log',       RED),
    ('[K]',   'Behavior Patterns',  'K-Means live scatter · session cluster tracker',   AMBER),
]

pw, ph = 7.2, 0.58
px0, py0 = 0.4, 7.55
col_gap = 7.8

for i, (icon, name, desc, col) in enumerate(pages):
    col_idx = i % 2
    row_idx = i // 2
    px = px0 + col_idx * col_gap
    py = py0 - row_idx * (ph + 0.12)
    card(ax, px, py, pw, ph, CARD, col, radius=0.12, lw=1.5)
    ax.text(px+0.35, py+ph/2, icon, fontsize=17, ha='center', va='center', zorder=5)
    ax.text(px+0.72, py+ph*0.72, name, color=col, fontsize=13, fontweight='bold',
            ha='left', va='center', zorder=5)
    ax.text(px+0.72, py+ph*0.25, desc, color=TEXT, fontsize=10,
            ha='left', va='center', zorder=5)

# Viz types box
card(ax, 0.4, 0.5, W-0.8, 0.78, CARD2, GREEN, radius=0.15, lw=1.5)
ax.text(0.8, 0.9, 'Visualization Types:', color=GREEN, fontsize=12, fontweight='bold',
        va='center', zorder=5)
viz = 'Line Charts   ·   Bar Charts   ·   Scatter Plots   ·   Arc Gauge   ·   Tables   ·   Stacked Bars   ·   Heatmaps   ·   Violin Plots'
ax.text(4.0, 0.9, viz, color=TEXT, fontsize=11, va='center', zorder=5)

ax.text(0.5, 0.2, 'IT4021 · SleepNest', color=SUB, fontsize=10, va='center', zorder=5)
ax.text(W-0.5, 0.2, 'Slide 5 / 8', color=SUB, fontsize=10, ha='right', va='center', zorder=5)
save(f, '05_dashboard.png')


# ═══════════════════════════════════════════════════════════════════
# SLIDE 6 — Software Design Decisions
# ═══════════════════════════════════════════════════════════════════
print("Generating slide 6...")
f = fig(); ax = ax_full(f)
ax.add_patch(plt.Rectangle((0, H-0.18), W, 0.18, color=AMBER, zorder=3))

section_title(ax, 'Software Engineering & Design Decisions', 0.5, 8.35, 27)

decisions = [
    ('ONNX for ML Inference', GREEN,
     'Run Python-trained Random Forest in Node.js without Python runtime.',
     'Same server handles API + ML  →  no separate microservice needed'),
    ('DataBuffer Batching (30s)', BLUE,
     'ESP32 sends every 2s = 1,800 writes/hour if written directly to MongoDB.',
     'Buffer in memory → flush aggregated doc every 30s = 120 writes/hr (15× less)'),
    ('React SensorContext', AMBER,
     'Single source of truth for all 11 dashboard pages.',
     'Polls /api/devices every 2s → distributes live data to all components'),
    ('Config.json Persistence', PURPLE,
     'ML thresholds need to survive server restarts (not reset to defaults).',
     'Settings page writes to config.json → loaded on startup automatically'),
    ('Synthetic Dataset', RED,
     'Only 2 days of real data collected — too few for robust ML training.',
     '10,000-row synthetic dataset + 25% borderline + 10% outlier + 6% noise'),
    ('Adapter Pattern', GREEN,
     'ESP32 firmware update changed the payload structure mid-development.',
     'adaptESP32DataFormat() layer isolates hardware changes from server logic'),
]

dw, dh = 4.95, 1.32
dx_list = [0.4, 5.65]
dy0 = 6.6

for i, (title, col, why, benefit) in enumerate(decisions):
    dx = dx_list[i % 2]
    dy = dy0 - (i // 2) * (dh + 0.28)
    card(ax, dx, dy, dw, dh, CARD, col, radius=0.18, lw=2)
    ax.text(dx+0.3, dy+dh-0.28, title, color=col, fontsize=13, fontweight='bold',
            ha='left', va='center', zorder=5)
    ax.text(dx+0.3, dy+dh-0.62, 'Why: '+why, color=TEXT, fontsize=10.5,
            ha='left', va='center', zorder=5)
    ax.text(dx+0.3, dy+0.28, '>> '+benefit, color=col+'CC', fontsize=10,
            ha='left', va='center', zorder=5)

# Folder structure strip
card(ax, 0.4, 0.45, W-0.8, 0.75, CARD2, BORDER, radius=0.12, lw=1)
structure = 'DIR: db/  mongo.js · DataBuffer.js · Aggregator.js     DIR: ml/  MLPredictor.js · sleepnest_classifier.onnx     DIR: frontend/src/pages/  (11 pages)     DIR: frontend/src/context/  SensorContext.jsx'
ax.text(W/2, 0.83, structure, color=SUB, fontsize=10, ha='center', va='center', zorder=5)

ax.text(0.5, 0.2, 'IT4021 · SleepNest', color=SUB, fontsize=10, va='center', zorder=5)
ax.text(W-0.5, 0.2, 'Slide 6 / 8', color=SUB, fontsize=10, ha='right', va='center', zorder=5)
save(f, '06_software_design.png')


# ═══════════════════════════════════════════════════════════════════
# SLIDE 7 — Challenges and Lessons Learned
# ═══════════════════════════════════════════════════════════════════
print("Generating slide 7...")
f = fig(); ax = ax_full(f)
ax.add_patch(plt.Rectangle((0, H-0.18), W, 0.18, color=RED, zorder=3))

section_title(ax, 'Challenges & Lessons Learned', 0.5, 8.35, 28)

challenges = [
    (RED,    '', 'Sound Threshold Calibration',
     'Ambient noise floor ~70 always triggered CRYING with default thresholds.',
     'Analysed real sensor CSV → tuned thresholds to 70/110/250/400.',
     'Always analyse real sensor data before setting any threshold value.'),
    (AMBER,  '[%]', 'Model Overfitting (100% Accuracy)',
     'First synthetic dataset gave 100% accuracy — model just memorised data.',
     'Added 25% borderline + 10% outlier + 6% label noise → 92.8% accuracy.',
     'Perfect accuracy is a red flag, not a success — models must generalise.'),
    (BLUE,   '', 'ESP32 Payload Format Changes',
     'ESP32 firmware update changed JSON structure mid-development.',
     'Built adaptESP32DataFormat() adapter as a translation layer.',
     'Always add an adapter layer between hardware and application logic.'),
    (GREEN,  '️', 'MongoDB Write Rate Limits',
     '2-second sensor polling = 1,800 potential MongoDB writes per hour.',
     'DataBuffer pattern batches 30s of readings into one aggregated document.',
     'Design for write efficiency from the start in any IoT streaming system.'),
    (PURPLE, '', 'Running Python ML in Node.js',
     'Random Forest trained in Python — server runs in Node.js (JavaScript).',
     'Exported model to ONNX format → loaded via onnxruntime-node package.',
     'ONNX is the universal cross-platform standard for ML model deployment.'),
]

rh = 1.18
ry0 = 7.2
rx = 0.5
rw = W - 1.0

for i, (col, icon, title, problem, solution, lesson) in enumerate(challenges):
    ry = ry0 - i*(rh+0.12)
    card(ax, rx, ry, rw, rh, CARD, col, radius=0.15, lw=1.8)
    # Number circle
    circ = plt.Circle((rx+0.42, ry+rh/2), 0.28, color=col, zorder=4)
    ax.add_patch(circ)
    ax.text(rx+0.42, ry+rh/2, str(i+1), color=BG, fontsize=13, fontweight='bold',
            ha='center', va='center', zorder=5)
    # Title
    ax.text(rx+0.88, ry+rh-0.28, icon+'  '+title, color=col, fontsize=13, fontweight='bold',
            ha='left', va='center', zorder=5)
    # 3 columns
    ax.text(rx+0.88, ry+rh*0.52, 'Problem: '+problem, color=TEXT, fontsize=10.5,
            ha='left', va='center', zorder=5)
    ax.text(rx+0.88, ry+0.2, '>> '+solution, color=col+'DD', fontsize=10.5,
            ha='left', va='center', zorder=5)
    # Lesson pill on right
    lx = rx+rw-5.5
    ax.add_patch(FancyBboxPatch((lx, ry+0.12), 5.2, 0.5,
        boxstyle='round,pad=0,rounding_size=0.1',
        facecolor=col+'22', edgecolor=col+'55', linewidth=1, zorder=4))
    ax.text(lx+0.15, ry+0.37, 'Lesson: '+lesson, color=col, fontsize=9.5,
            ha='left', va='center', zorder=5)

ax.text(0.5, 0.22, 'IT4021 · SleepNest', color=SUB, fontsize=10, va='center', zorder=5)
ax.text(W-0.5, 0.22, 'Slide 7 / 8', color=SUB, fontsize=10, ha='right', va='center', zorder=5)
save(f, '07_challenges.png')


# ═══════════════════════════════════════════════════════════════════
# SLIDE 8 — Future Enhancements
# ═══════════════════════════════════════════════════════════════════
print("Generating slide 8...")
f = fig(); ax = ax_full(f)
ax.add_patch(plt.Rectangle((0, H-0.18), W, 0.18, color=GREEN, zorder=3))

section_title(ax, 'Future Enhancements', 0.5, 8.35, 28)

columns = [
    ('[RT]  Short-term', GREEN, [
        ('', 'Mobile App (React Native)', 'Push notifications when baby cries'),
        ('', 'Edge Inference on ESP32',   'TensorFlow Lite — no WiFi required'),
        ('', 'SMS/Email Alerts',           'Twilio integration for remote parents'),
        ('', 'Auto model retraining',     'Retrain monthly with new real data'),
    ]),
    ('Medium-term', BLUE, [
        ('', 'Multi-room Support',        'Multiple device IDs per household'),
        ('', 'Parent Sleep Correlation',  'Compare baby/parent sleep schedules'),
        ('', 'Report Export',             'PDF sleep reports for paediatrician'),
        ('', 'Smart Home Integration',    'Philips Hue + thermostat control'),
    ]),
    ('[S]  Long-term', PURPLE, [
        ('', 'Federated Learning',        'Train shared model without sharing data'),
        ('', 'Cry Prediction (LSTM)',     'Predict crying before it happens'),
        ('️', 'FFT Sound Features',        'Spectral analysis → better accuracy'),
        ('', 'Clinical-grade Mode',       'Certified sleep quality reports'),
    ]),
]

cw, ch = 4.7, 5.6
cx0 = 0.45
cgap = 0.52
cy_col = 1.5

for ci, (heading, col, items) in enumerate(columns):
    cx = cx0 + ci*(cw+cgap)
    card(ax, cx, cy_col, cw, ch, CARD, col, radius=0.2, lw=2)
    # Header
    ax.add_patch(FancyBboxPatch((cx, cy_col+ch-0.88), cw, 0.88,
        boxstyle='round,pad=0,rounding_size=0.2',
        facecolor=col+'33', edgecolor='none', zorder=3))
    ax.text(cx+cw/2, cy_col+ch-0.44, heading, color=col, fontsize=14, fontweight='bold',
            ha='center', va='center', zorder=5)

    for j, (icon, title, desc) in enumerate(items):
        iy = cy_col+ch-1.35-j*1.08
        card(ax, cx+0.22, iy-0.32, cw-0.44, 0.9, BG, col+'55', radius=0.1, lw=1)
        ax.text(cx+0.55, iy+0.13, icon, fontsize=15, ha='center', va='center', zorder=5)
        ax.text(cx+0.92, iy+0.22, title, color=col, fontsize=11, fontweight='bold',
                ha='left', va='center', zorder=5)
        ax.text(cx+0.92, iy-0.1, desc, color=TEXT, fontsize=9.5,
                ha='left', va='center', zorder=5)

# Research note
card(ax, 0.45, 0.48, W-0.9, 0.72, CARD2, AMBER, radius=0.15, lw=1.5)
ax.text(0.85, 0.84, 'Research Direction:', color=AMBER, fontsize=12, fontweight='bold',
        va='center', zorder=5)
ax.text(4.0, 0.84,
        'Investigate whether FFT sound spectral features improve cry detection accuracy beyond current 92.8%',
        color=TEXT, fontsize=11, va='center', zorder=5)

ax.text(0.5, 0.18, 'IT4021 · SleepNest', color=SUB, fontsize=10, va='center', zorder=5)
ax.text(W-0.5, 0.18, 'Slide 8 / 8', color=SUB, fontsize=10, ha='right', va='center', zorder=5)
save(f, '08_future.png')

print("\n>> All 8 slides saved to the 'slides/' folder.")
