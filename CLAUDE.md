# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**SleepNest** is an IoT baby monitoring system that monitors a baby's environment in real-time through temperature, humidity, motion, light, and audio analysis. The system combines an Arduino Uno (sensors) and ESP32 (audio processing + WiFi) to collect data and stream it to a Node.js backend with a React frontend dashboard.

### Key Technologies
- **Backend**: Node.js + Express + WebSocket (ws) + MongoDB
- **Frontend**: React 18 + Vite + Tailwind CSS + Chart.js
- **Hardware**: Arduino Uno (sensors via UART), ESP32 (audio + WiFi), INMP441 I2S microphone, DHT11, PIR motion sensor, LDR light sensor

---

## Architecture & Data Flow

### System Architecture

```
Arduino Uno (Sensors)
    ↓ UART Serial @ 9600 baud
ESP32 (Gateway + Audio Processing)
    ↓ WebSocket over WiFi
Node.js Server (server.js @ port 3007)
    ├→ In-Memory Buffers
    ├→ MongoDB
    └→ HTTP + WebSocket for Frontend
        ↓
React Frontend (Vite @ port 5173)
```

### Data Collection Pipeline

1. **Arduino Uno** sends sensor data every 2 seconds: `T:31.70,H:59.00,M:0,MC:7,L:359`

2. **ESP32** reads Arduino via UART, captures I2S microphone, detects crying, sends to server

3. **Server (server.js)** adapts format, processes sound with SoundProcessor, stores in-memory state, buffers to MongoDB every 30s

4. **Frontend** polls `/api/devices` every 2 seconds, renders real-time data

---

## Development Commands

### Backend (Node.js)
```bash
npm install              # Install dependencies
npm run dev              # Development with nodemon
npm start                # Production
```

### Frontend (React + Vite)
```bash
cd frontend
npm install              # Install dependencies
npm run dev              # Dev server @ localhost:5173
npm run build            # Build to dist/
npm run preview          # Preview build
```

### Environment Setup

Copy `.env.example` to `.env`:
```
PORT=3007
MONGO_URI=mongodb+srv://...
MONGO_DB=sleepnest
```

ESP32 config (arduino_code/esp32.txt):
- WiFi SSID/password
- ws_host (your server IP)
- I2S pins: WS=GPIO15, SCK=GPIO14, SD=GPIO32

Arduino Uno config (arduino_code/a_uno.txt):
- DHT11 on GPIO4, PIR on GPIO5, LDR on A0
- Serial @ 9600 baud

---

## API Endpoints

### Device Status
- **GET /api/devices** → List all connected devices
- **GET /api/devices/:deviceId** → Device details + sound analysis
- **GET /api/devices/:deviceId/sound/analysis** → Advanced metrics

### Device Commands
- **POST /api/devices/:deviceId/command** → Send command
- **POST /api/devices/:deviceId/calibrate** → Recalibrate sound sensor
- **POST /api/devices/:deviceId/auto-tune** → Auto-adjust sensitivity

### MongoDB Queries
- **GET /api/db/readings** → Raw readings
- **GET /api/db/events** → Events
- **GET /api/db/stats/hourly** → Hourly summaries
- **GET /api/db/stats/daily** → Daily summaries
- **GET /api/db/health** → DB health check

---

## Key Configuration

### Sound Thresholds (server.js CONFIG)
- QUIET: 0-6
- LIGHT_ACTIVITY: 6-20
- RESTLESS: 20-40
- CRYING: 40+
- sensitivityRange: 1-20 (default 5)
- alertCooldown: 5000 ms
- maxHistorySize: 5000

### Comfort Score Formula

```
tempScore = max(0, 100 - |temp - 20C| * 8)
humScore = max(0, 100 - |humidity - 50%| * 2.5)
soundScore = max(0, 100 - (soundLevel / 1023) * 100)
comfort = tempScore * 0.35 + humScore * 0.25 + soundScore * 0.40 - motionPenalty
```

---

## Frontend Structure

### Pages (frontend/src/pages/)
- **BabySitterView** → Full-screen comfort arc (default landing)
- **Overview** → Main dashboard
- **Monitoring** → Real-time sensor charts
- **Sleep** → Sleep quality
- **Alerts** → Alert log
- **History** → In-session data table
- **Settings** → Device config + thresholds

### Context (frontend/src/context/SensorContext.jsx)
- Polls `/api/devices` every 2 seconds
- Maintains rolling histories
- Tracks state transitions
- Computes comfort with motion penalty

---

## Implementation Details

### Data Format Adaptation (server.js line 71-134)

New ESP32 payload has nested `audio` and `sensors` objects. The `adaptESP32DataFormat()` function converts to legacy format. If ESP32 payload changes, update this first.

### Sound Processing Pipeline

1. Capture: 512 I2S samples at 16kHz
2. Normalize: Convert to 0-1023 range
3. Baseline: Calibration establishes noise floor
4. Confirmation: 3 consecutive loud frames trigger cry
5. Server: SoundProcessor calculates energy/stability/trend

### MongoDB Persistence

- **DataBuffer** flushes every 30s to `readings`
- **Aggregator** runs hourly, creates `hourly_stats`
- **Events** written immediately on state changes
- **TTL**: Raw readings expire after 7 days

### Frontend State

- **SensorContext** is source of truth
- **Local history** in-session only (500 readings)
- **Comfort penalty** when motion >= 15s threshold

---

## Common Tasks

### Adding a New Sensor

1. Arduino Uno: Output in `T:...,H:...,M:...,MC:...,L:...` format
2. ESP32: Update `parseArduinoData()` and `sensors` object
3. Server: Update `adaptESP32DataFormat()` and Device.data
4. MongoDB: Update DataBuffer schema
5. Frontend: Add display

### Adjusting Sound Thresholds

1. Edit `CONFIG.soundThresholds` in server.js
2. Restart server
3. Use `/api/devices/:deviceId/calibrate` to recalibrate
4. Use `/api/devices/:deviceId/auto-tune` to adjust

### Modifying Comfort Calculation

- Update `calcComfort()` in frontend/src/utils/comfort.js
- Mirror changes in db/DataBuffer.js line 44-50
- Both must match

---

## Debugging

### Server Logs
- Console: Real-time readings with sound bars
- Hourly report: Summary every hour
- File logs in ./logs/:
  - motion_YYYY-MM-DD.log
  - alerts_YYYY-MM-DD.log
  - errors_YYYY-MM-DD.log

### MongoDB
```javascript
db.readings.find({ deviceId: "ESP32_GREENHOUSE_01" }).sort({ ts: -1 }).limit(10)
```

### Frontend
- DevTools Network: Monitor `/api/devices` (every 2s)
- Console: Check errors

---

## Important Gotchas

1. **Format Adapter**: Critical for ESP32 format. Update first if payload changes.

2. **Comfort Penalty**: Only when motion >= 15s threshold (configurable in Settings).

3. **Timezone**: Hourly stats bucket by UTC. Adjust Aggregator.js if needed.

4. **Motion Duration**: Arduino sends MC (count) and M (state). Server tracks ms.

5. **MongoDB TTL**: Raw readings auto-delete after 7 days. Archive before TTL.

6. **WebSocket Heartbeat**: Devices heartbeat every 30s. Marked stale if no message in 60s.

7. **DataBuffer Flush**: 30s interval. Reduce for higher write frequency.

---

## File Structure

```
kukka_arduino/
├── server.js
├── package.json
├── .env
├── db/
│   ├── mongo.js
│   ├── DataBuffer.js
│   └── Aggregator.js
├── arduino_code/
│   ├── esp32.txt
│   └── a_uno.txt
├── frontend/
│   ├── package.json
│   ├── vite.config.js
│   ├── tailwind.config.js
│   └── src/
│       ├── App.jsx
│       ├── context/
│       ├── pages/
│       ├── components/
│       └── utils/
└── logs/
```

