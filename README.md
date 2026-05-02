# SleepNest IoT — Baby Monitoring System

SleepNest is a full-stack IoT baby monitoring system that provides real-time environmental analysis for a baby's room. It combines embedded hardware (Arduino Uno + ESP32), a Node.js backend, a machine learning classifier, and a React dashboard to continuously monitor temperature, humidity, motion, light, and audio — computing a live **Comfort Score** and detecting crying in real time.

---

## Table of Contents

- [Features](#features)
- [System Architecture](#system-architecture)
- [Hardware Components](#hardware-components)
- [Technology Stack](#technology-stack)
- [Data Flow](#data-flow)
- [Machine Learning](#machine-learning)
- [Comfort Score Formula](#comfort-score-formula)
- [API Reference](#api-reference)
- [Frontend Pages](#frontend-pages)
- [Project Structure](#project-structure)
- [Getting Started](#getting-started)
- [Configuration](#configuration)
- [Database & Persistence](#database--persistence)
- [Sound Thresholds](#sound-thresholds)
- [Debugging](#debugging)

---

## Features

- **Real-time sensor streaming** — temperature, humidity, motion, light, and sound every ~2 seconds
- **Cry detection** — ESP32 runs I2S audio capture and confirms cry events with 3 consecutive frames
- **ML classifier** — ONNX Random Forest model (92.8% accuracy) classifies baby state from a 15-sample rolling window
- **Comfort Score** — weighted formula combining temp, humidity, and sound into a 0–100 score
- **Smart alerts** — motion, cry, and environment alerts with cooldown deduplication
- **MongoDB persistence** — batched writes every 30 s; hourly aggregation; 7-day TTL on raw readings
- **Configurable thresholds** — sound thresholds and sensitivity adjustable from the Settings page and persisted to disk
- **BabySitter View** — full-screen comfort arc for at-a-glance monitoring

---

## System Architecture

```
┌──────────────────────────────────────────────────────────┐
│                      Hardware Layer                       │
│                                                          │
│  Arduino Uno                     ESP32                   │
│  ─────────────────               ──────────────────────  │
│  • DHT11 (temp/humidity)         • Reads Arduino via     │
│  • PIR sensor (motion)             UART @ 9600 baud      │
│  • LDR (light)                   • INMP441 I2S mic       │
│  • Sends every 2 s →             • Cry detection         │
│    T:31.70,H:59.00,M:0,MC:7,L:359  • WiFi WebSocket →   │
└──────────────────────────────────────────────────────────┘
                          │ WebSocket (port 3007)
                          ▼
┌──────────────────────────────────────────────────────────┐
│                     Backend Layer                         │
│                                                          │
│  Node.js + Express (server.js)                           │
│  ─────────────────────────────                          │
│  • WebSocket server (receives ESP32 data)                │
│  • SoundProcessor / MLPredictor                          │
│  • In-memory device state + rolling history              │
│  • DataBuffer (batches to MongoDB every 30 s)            │
│  • Aggregator (hourly stats)                             │
│  • REST API + WebSocket push for frontend                │
│  • File-based alert/motion/error logs                    │
└──────────────────────────────────────────────────────────┘
                          │ HTTP polling (every 2 s)
                          ▼
┌──────────────────────────────────────────────────────────┐
│                    Frontend Layer                         │
│                                                          │
│  React 18 + Vite (port 5173)                             │
│  ───────────────────────────                            │
│  • SensorContext — polls /api/devices, maintains state   │
│  • BabySitter View, Overview, Monitoring, Sleep          │
│  • Alerts, History, Settings pages                       │
│  • Chart.js real-time charts                             │
└──────────────────────────────────────────────────────────┘
                          │
                          ▼
┌──────────────────────────────────────────────────────────┐
│                   Persistence Layer                       │
│                                                          │
│  MongoDB Atlas                                           │
│  ─────────────                                          │
│  • readings       (raw, 7-day TTL)                       │
│  • hourly_stats   (aggregated)                           │
│  • events         (state changes, immediate write)       │
└──────────────────────────────────────────────────────────┘
```

---

## Hardware Components

| Component | Role | Interface |
|-----------|------|-----------|
| **Arduino Uno** | Reads DHT11, PIR, LDR sensors | UART → ESP32 |
| **ESP32** | WiFi gateway + audio processor | WiFi WebSocket |
| **DHT11** | Temperature & humidity | GPIO 4 (Arduino) |
| **PIR Sensor** | Motion detection | GPIO 5 (Arduino) |
| **LDR** | Ambient light level | A0 (Arduino) |
| **INMP441** | I2S MEMS microphone | GPIO 15/14/32 (ESP32) |

### Arduino Serial Format

```
T:31.70,H:59.00,M:0,MC:7,L:359
```

| Field | Meaning |
|-------|---------|
| `T` | Temperature in °C |
| `H` | Relative humidity % |
| `M` | Motion state (0/1) |
| `MC` | Motion count (session total) |
| `L` | Light level (0–1023, LDR ADC) |

### ESP32 Audio Pipeline

1. Capture 512 I2S samples at 16 kHz
2. Normalize to 0–1023 range
3. Establish noise floor baseline on boot (calibration)
4. Trigger cry if amplitude > `baseline × 2.5` for 3 consecutive frames
5. Send full JSON payload via WebSocket to server

---

## Technology Stack

### Backend
| Package | Version | Purpose |
|---------|---------|---------|
| Node.js | — | Runtime |
| Express | ^4.22 | HTTP server & REST API |
| ws | ^8.19 | WebSocket server |
| mongodb | ^7.1 | MongoDB driver |
| onnxruntime-node | ^1.24 | ONNX model inference |
| dotenv | ^17 | Environment config |
| uuid | ^9 | Device session IDs |
| nodemon | ^3 | Dev auto-restart |

### Frontend
| Package | Version | Purpose |
|---------|---------|---------|
| React | ^18.3 | UI framework |
| Vite | ^5.4 | Build tool & dev server |
| react-router-dom | ^6.26 | Client-side routing |
| chart.js | ^4.4 | Data visualisation |
| react-chartjs-2 | ^5.2 | Chart.js React wrapper |
| Tailwind CSS | ^3.4 | Utility-first styling |
| lucide-react | ^0.577 | Icon library |

### ML / Data Science (Python)
| Script | Purpose |
|--------|---------|
| `generate_dataset.py` | Synthesise labelled training data |
| `export_dataset.py` | Export MongoDB readings to CSV |
| `train_model.py` | Train Random Forest, export ONNX |
| `model_report.py` | Accuracy / F1 report |
| `analysis_trend.py` | Trend analysis on readings |
| `analysis_correlation.py` | Sensor correlation analysis |
| `analysis_anomaly.py` | Anomaly detection |

---

## Data Flow

```
1. Arduino Uno
   └── Every 2 s: Serial.print("T:31.70,H:59.00,M:0,MC:7,L:359\n")

2. ESP32
   ├── Reads Arduino UART
   ├── Captures I2S audio, computes amplitude
   ├── Detects cry (3-frame confirmation)
   └── Sends JSON WebSocket payload:
       {
         device_id, timestamp,
         audio: { amplitude, is_crying, baseline, calibrated },
         sensors: { temperature, humidity, motion, motionCount, lightLevel }
       }

3. Node.js server.js
   ├── adaptESP32DataFormat()  — normalises nested payload
   ├── MLPredictor.classify()  — 15-sample window → ONNX inference
   ├── Updates in-memory device state
   ├── Checks sound/motion thresholds → alerts
   ├── DataBuffer.push()       — accumulates for 30 s flush
   └── Logs motion/alerts to ./logs/

4. Frontend SensorContext
   ├── Polls GET /api/devices every 2 s
   ├── Computes comfort score + motion penalty
   ├── Updates rolling histories (60 points)
   └── Renders charts, alerts, comfort arc
```

---

## Machine Learning

The server integrates a **Random Forest** classifier exported to ONNX format.

### Model Details

| Property | Value |
|----------|-------|
| Algorithm | Random Forest |
| Test Accuracy | **92.8%** |
| Macro F1 | **0.9284** |
| Feature Count | 19 |
| Window Size | 15 samples |
| Output Classes | CRYING, RESTLESS, LIGHT_ACTIVITY, QUIET |
| Model File | `model/sleepnest_classifier.onnx` |

### Features Used

```
sound.avg, sound.max, sound.last, sound_range, sound_stability,
soundHist.QUIET, soundHist.LIGHT_ACTIVITY, soundHist.RESTLESS, soundHist.CRYING,
hist_cry_ratio, motion.samplesActive, motion.durationMs, motion_active_ratio,
temp.avg, humidity.avg, light.avg, comfort.avg,
hour_sin, hour_cos   ← cyclical time encoding
```

### Fallback Behaviour

If the ONNX model is unavailable at startup, `MLPredictor` falls back to configurable fixed thresholds automatically. No manual intervention required.

---

## Comfort Score Formula

The Comfort Score (0–100) is computed identically on both the server (`db/DataBuffer.js`) and frontend (`frontend/src/utils/comfort.js`):

$$\text{tempScore} = \max(0,\ 100 - |T - 20| \times 8)$$

$$\text{humScore} = \max(0,\ 100 - |H - 50| \times 2.5)$$

$$\text{soundScore} = \max(0,\ 100 - \frac{S}{1023} \times 100)$$

$$\text{comfort} = \lfloor\ 0.35 \cdot \text{tempScore} + 0.25 \cdot \text{humScore} + 0.40 \cdot \text{soundScore}\ \rfloor - \text{motionPenalty}$$

| Score Range | Status |
|-------------|--------|
| 85 – 100 | Baby is Deeply Resting 😴 |
| 70 – 84 | Baby is Sleeping Well 🌙 |
| 55 – 69 | Baby in Light Sleep 😪 |
| 40 – 54 | Baby is Restless 😟 |
| 0 – 39 | Baby Needs Attention 😭 |

> The **motion penalty** (0 / 5 / 25 pts) is applied only on the frontend based on the configurable motion duration threshold (default 15 s). The server-side comfort score for MongoDB does not include the penalty.

---

## API Reference

### Device Status

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/devices` | List all connected devices |
| GET | `/api/devices/:deviceId` | Device details + sound analysis |
| GET | `/api/devices/:deviceId/sound/analysis` | Advanced sound metrics |

### Device Commands

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/devices/:deviceId/command` | Send command to device |
| POST | `/api/devices/:deviceId/calibrate` | Recalibrate sound baseline |
| POST | `/api/devices/:deviceId/auto-tune` | Auto-adjust sensitivity |

### MongoDB Queries

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/db/readings` | Raw sensor readings |
| GET | `/api/db/events` | State-change events |
| GET | `/api/db/stats/hourly` | Hourly aggregated summaries |
| GET | `/api/db/stats/daily` | Daily aggregated summaries |
| GET | `/api/db/health` | Database connection health |

---

## Frontend Pages

| Route | Page | Description |
|-------|------|-------------|
| `/babysitter` | **BabySitter View** | Full-screen comfort arc — default landing page |
| `/overview` | **Overview** | Main dashboard with status cards and insights |
| `/monitoring` | **Monitoring** | Real-time Chart.js graphs for all sensors |
| `/sleep` | **Sleep** | Sleep quality analysis and summaries |
| `/alerts` | **Alerts** | Chronological alert log |
| `/history` | **History** | In-session tabular data (last 500 readings) |
| `/settings` | **Settings** | Device config, sound thresholds, sensitivity |

### State Management

All sensor state flows through `SensorContext` (React Context API):

```
SensorContext
├── device           — latest device object from API
├── connected        — WebSocket/HTTP connection status
├── tempHistory      — 60-point rolling temperature array
├── noiseHistory     — 60-point rolling sound % array
├── motionHistory    — 60-point rolling motion state array
├── timeline         — last 20 significant events
├── alertLog         — last 100 alerts
├── soundDist        — QUIET / LIGHT_ACTIVITY / RESTLESS / CRYING counts
├── localHistory     — 500-row in-session table data
├── motionCount      — session motion event total
└── motionThreshold  — configurable ms threshold (default 15 000)
```

---

## Project Structure

```
SleepNest-IOT/
├── server.js                  # Main backend entry point
├── package.json               # Backend dependencies
├── .env                       # Environment variables (PORT, MONGO_URI)
├── config.json                # Persisted runtime config (thresholds etc.)
├── CLAUDE.md                  # AI assistant guidance
│
├── db/
│   ├── mongo.js               # MongoDB connection helper
│   ├── DataBuffer.js          # Batched write buffer (30 s flush)
│   └── Aggregator.js          # Hourly stats aggregation
│
├── ml/
│   └── MLPredictor.js         # ONNX inference + rolling window
│
├── model/
│   ├── sleepnest_classifier.onnx   # Trained Random Forest model
│   └── model_meta.json             # Feature list, classes, accuracy
│
├── arduino_code/
│   ├── a_uno.txt              # Arduino Uno sketch (DHT11 / PIR / LDR)
│   └── esp32.txt              # ESP32 sketch (WiFi / I2S / WebSocket)
│
├── frontend/
│   ├── package.json
│   ├── vite.config.js
│   ├── tailwind.config.js
│   └── src/
│       ├── App.jsx            # Router setup
│       ├── index.css          # Tailwind base styles
│       ├── main.jsx           # React entry point
│       ├── context/
│       │   └── SensorContext.jsx   # Global sensor state + polling
│       ├── components/
│       │   ├── layout/        # Layout, Sidebar, Topbar
│       │   └── overview/      # StatusCard, TrendChart, Insights, etc.
│       ├── pages/             # BabySitterView, Overview, Monitoring…
│       └── utils/
│           ├── comfort.js     # Comfort score + labels
│           └── format.js      # Date/number formatters
│
├── logs/                      # Auto-created log files (daily rotation)
│   ├── motion_YYYY-MM-DD.log
│   ├── alerts_YYYY-MM-DD.log
│   └── errors_YYYY-MM-DD.log
│
├── public/                    # Static HTML pages
│
└── *.py                       # Python ML / data analysis scripts
```

---

## Getting Started

### Prerequisites

- Node.js 18+
- MongoDB Atlas account (or local instance)
- Arduino IDE with ESP32 / Arduino Uno board support

### 1. Clone & Install

```bash
# Backend
npm install

# Frontend
cd frontend
npm install
```

### 2. Environment Setup

Create a `.env` file in the project root:

```env
PORT=3007
MONGO_URI=mongodb+srv://<user>:<pass>@cluster.mongodb.net/
MONGO_DB=sleepnest
```

### 3. Flash Hardware

**Arduino Uno** (`arduino_code/a_uno.txt`):
- DHT11 → GPIO 4
- PIR sensor → GPIO 5
- LDR → A0
- Serial baud rate: 9600

**ESP32** (`arduino_code/esp32.txt`):
- Update `ssid` / `password` with your WiFi credentials
- Set `ws_host` to your server's LAN IP
- INMP441 mic: WS → GPIO 15, SCK → GPIO 14, SD → GPIO 32

### 4. Run

```bash
# Terminal 1 — Backend
npm run dev          # development (nodemon)
npm start            # production

# Terminal 2 — Frontend
cd frontend
npm run dev          # http://localhost:5173
```

### 5. Open Dashboard

Navigate to [http://localhost:5173](http://localhost:5173) — the BabySitter View loads by default.

---

## Configuration

Runtime configuration is persisted to `config.json` and loaded on startup. You can change values from the **Settings** page or directly via the API.

### Sound Thresholds

```json
{
  "soundThresholds": {
    "QUIET": 70,
    "LIGHT_ACTIVITY": 110,
    "RESTLESS": 250,
    "CRYING": 400
  }
}
```

These are raw ADC amplitude values (0–1023) from the INMP441 microphone.

### Sensitivity

| Setting | Value |
|---------|-------|
| Min | 1 |
| Max | 20 |
| Default | 5 |

### Key Timings

| Parameter | Default | Description |
|-----------|---------|-------------|
| `alertCooldown` | 5 000 ms | Minimum gap between same-type alerts |
| `motionCooldown` | 2 000 ms | Minimum gap between motion alerts |
| `DataBuffer flush` | 30 000 ms | MongoDB write interval |
| `soundSmoothing.windowSize` | 5 | Moving average window size |

---

## Database & Persistence

### Collections

| Collection | Contents | Retention |
|------------|----------|-----------|
| `readings` | Aggregated 30 s windows | 7-day TTL |
| `hourly_stats` | Hourly summaries | Permanent |
| `events` | State-change edges (cry start, motion start) | Permanent |

### readings Document Schema

```json
{
  "deviceId": "ESP32_GREENHOUSE_01",
  "ts": "2026-04-26T10:00:00.000Z",
  "sampleCount": 15,
  "temp":    { "avg": 22.1, "min": 21.8, "max": 22.4, "last": 22.3 },
  "humidity":{ "avg": 55.0, "min": 54.0, "max": 56.0, "last": 55.5 },
  "sound":   { "avg": 85,   "max": 120,  "last": 90,  "event": "LIGHT_ACTIVITY" },
  "comfort": { "avg": 72,   "last": 74 },
  "motion":  { "samplesActive": 2, "durationMs": 4000 },
  "light":   { "avg": 400,  "last": 410 },
  "soundHist": { "QUIET": 10, "LIGHT_ACTIVITY": 4, "RESTLESS": 1, "CRYING": 0 },
  "lastRaw": { ... }
}
```

### Useful Queries

```javascript
// Latest 10 readings for a device
db.readings.find({ deviceId: "ESP32_GREENHOUSE_01" }).sort({ ts: -1 }).limit(10)

// All cry events today
db.events.find({ type: "CRYING", ts: { $gte: new Date("2026-04-26") } })

// Hourly stats for a device
db.hourly_stats.find({ deviceId: "ESP32_GREENHOUSE_01" }).sort({ ts: -1 }).limit(24)
```

---

## Sound Thresholds

| Level | Amplitude Range | Meaning |
|-------|----------------|---------|
| `QUIET` | 0 – 70 | Ambient noise, baby sleeping |
| `LIGHT_ACTIVITY` | 70 – 110 | Stirring, light sounds |
| `RESTLESS` | 110 – 250 | Fussing, movement noise |
| `CRYING` | 250+ | Active crying — alert triggered |

Use the calibrate endpoint to reset the noise floor after changing environment:

```bash
POST /api/devices/ESP32_GREENHOUSE_01/calibrate
POST /api/devices/ESP32_GREENHOUSE_01/auto-tune
```

---

## Debugging

### Server Logs (Console)

The server prints a real-time sound bar and sensor summary to the console on every reading.  
Hourly summary reports are also printed.

### Log Files (`./logs/`)

| File | Contents |
|------|----------|
| `motion_YYYY-MM-DD.log` | Motion start/stop events |
| `alerts_YYYY-MM-DD.log` | All generated alerts |
| `errors_YYYY-MM-DD.log` | Server-side errors |

### Frontend Debugging

- Open DevTools → **Network** tab → filter `/api/devices` to watch the 2 s poll
- Check **Console** for context errors

### Common Issues

| Issue | Solution |
|-------|---------|
| No device shown in dashboard | Ensure ESP32 is connected to same network and `ws_host` points to server IP |
| Comfort score always 0 | DHT11 may not be sending data — check Arduino serial output |
| All events labelled QUIET | Run `/calibrate` to reset noise floor, then `/auto-tune` |
| MongoDB write errors | Check `MONGO_URI` in `.env` and Atlas IP whitelist |
| ONNX model not found | Run `python train_model.py` to regenerate `model/sleepnest_classifier.onnx` |
