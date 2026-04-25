require('dotenv').config();               // load .env before anything else

const express   = require('express');
const http      = require('http');
const WebSocket = require('ws');
const { v4: uuidv4 } = require('uuid');
const path      = require('path');
const fs        = require('fs');

// ── MongoDB ─────────────────────────────────────────────────────
const { connectMongo, getDb } = require('./db/mongo');
const { dataBuffer }          = require('./db/DataBuffer');
const { startAggregator }     = require('./db/Aggregator');

// ── ML Predictor ─────────────────────────────────────────────────
const mlPredictor = require('./ml/MLPredictor');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

// Store connected devices and their data
const devices = new Map();
const deviceHistory = new Map();
const deviceStats = new Map();
const soundEvents = new Map();
const soundAlerts = new Map();

// Configuration
const CONFIG = {
  maxHistorySize: 5000,
  maxSoundEvents: 1000,
  alertCooldown: 5000, // ms between same type alerts
  motionCooldown: 2000, // ms between motion alerts
  soundThresholds: {
    QUIET: 150,
    LIGHT_ACTIVITY: 350,
    RESTLESS: 600,
    CRYING: 700
  },
  sensitivityRange: {
    min: 1,
    max: 20,
    default: 5
  },
  soundSmoothing: {
    enabled: true,
    windowSize: 5 // moving average window
  }
};

app.use(express.json());
app.use(express.static('public'));

// Create logs directory
if (!fs.existsSync('./logs')) {
  fs.mkdirSync('./logs');
}

// Logger function
function logToFile(type, deviceId, data) {
  const logEntry = {
    timestamp: Date.now(),
    type,
    deviceId,
    data
  };
  const logFile = `./logs/${type}_${new Date().toISOString().split('T')[0]}.log`;
  fs.appendFileSync(logFile, JSON.stringify(logEntry) + '\n');
}

// ========== FORMAT ADAPTER FOR ESP32 DATA ==========
// Converts new ESP32 format (with audio/sensors objects) to legacy format
function adaptESP32DataFormat(data) {
  // Check if this is the new format (has 'audio' and 'sensors' objects)
  if (data.audio && data.sensors) {
    console.log('🔄 Adapting new ESP32 format to legacy format');
    
    const audio = data.audio || {};
    const sensors = data.sensors || {};
    
    // Map amplitude to appropriate scale (0-1023 for legacy)
    const amplitude = audio.amplitude || 0;
    const mappedAmplitude = Math.min(1023, Math.floor(amplitude / 4)); // Convert from 0-4095 to 0-1023
    
    // Determine alert level string
    let soundAlert = 'Quiet';
    if (audio.crying) {
      soundAlert = 'CRYING DETECTED! ⚠️';
    } else if (data.alert_level === 'Restless') {
      soundAlert = 'Restless';
    } else if (data.alert_level === 'Light Activity') {
      soundAlert = 'Light Activity';
    }
    
    return {
      type: data.type,
      deviceId: data.deviceId,
      timestamp: data.timestamp,
      rssi: data.rssi,
      free_heap: data.free_heap,
      
      // Sound data mapping for legacy system
      sound: mappedAmplitude,
      sound_raw: amplitude,
      sound_diff: amplitude,
      sound_baseline: audio.baseline_noise || 0,
      sound_sensitivity: 5,
      sound_alert: soundAlert,
      sound_digital: audio.crying ? 1 : 0,
      sound_calibrated: audio.calibrated || false,
      
      // Thresholds (reasonable defaults)
      quiet_threshold: 25,
      light_activity_threshold: 80,
      restless_threshold: 200,
      crying_threshold: 400,
      noise_floor: 25,
      
      // Sensor data
      temperature: sensors.temperature || 0,
      humidity: sensors.humidity || 0,
      motion: sensors.motion || 0,
      motion_count: sensors.motion_count || 0,
      light: sensors.light || 0,
      motion_duration: 0,
      
      // Preserve original data for debugging
      _original_crying: audio.crying,
      _original_amplitude: amplitude,
      _original_alert_level: data.alert_level
    };
  }
  
  // Return original format if already legacy
  return data;
}

// Sound processor that matches ESP32 data format
class SoundProcessor {
  constructor(deviceId) {
    this.deviceId = deviceId;
    this.history = [];
    this.baseline = 0;
    this.calibrated = false;
    this.peakDetected = false;
    this.peakValue = 0;
    this.peakTime = 0;
    this.eventStartTime = 0;
    this.currentEvent = 'QUIET';
    this.energyLevel = 0;
    this.frequencyEstimate = 0;
    this.lastRawValue = 0;
    this.lastDiffValue = 0;
  }

  processSoundData(data) {
    // Extract values from ESP32 data format
    const level = data.sound || 0;           // sound level (0-1023)
    const raw = data.sound_raw || 0;         // raw ADC value
    const diff = data.sound_diff || 0;       // difference from baseline
    const baseline = data.sound_baseline || 0;
    const sensitivity = data.sound_sensitivity || CONFIG.sensitivityRange.default;
    const alert = data.sound_alert || 'QUIET';
    const calibrated = data.sound_calibrated || false;
    const digital = data.sound_digital || 0;
    
    // Store for reference
    this.lastRawValue = raw;
    this.lastDiffValue = diff;
    
    // Update baseline if provided
    if (baseline > 0 && !this.calibrated) {
      this.baseline = baseline;
      this.calibrated = calibrated;
      console.log(`✅ Sound sensor calibrated for ${this.deviceId}: baseline=${baseline}`);
    }
    
    // Add to history for smoothing
    this.history.push(level);
    if (this.history.length > CONFIG.soundSmoothing.windowSize) {
      this.history.shift();
    }
    
    // Apply moving average if enabled
    let smoothedLevel = level;
    if (CONFIG.soundSmoothing.enabled && this.history.length > 0) {
      smoothedLevel = this.history.reduce((a, b) => a + b, 0) / this.history.length;
    }
    
    // Calculate percentage based on ESP32's 0-1023 range
    const percentage = Math.round((level / 1023) * 100);
    
    // Detect peaks
    if (level > this.peakValue && level > 30) {
      this.peakValue = level;
      this.peakTime = Date.now();
      this.peakDetected = true;
    }
    
    // Reset peak after 2 seconds
    if (this.peakDetected && Date.now() - this.peakTime > 2000) {
      this.peakValue = 0;
      this.peakDetected = false;
    }
    
    // Calculate energy (recent activity)
    if (this.history.length > 1) {
      const recent = this.history.slice(-5);
      this.energyLevel = recent.reduce((sum, val) => sum + Math.abs(val - (this.baseline / 4095 * 1023)), 0) / recent.length;
    }
    
    // Determine sound event (use ESP32's alert or calculate)
    let event = alert;
    let eventCode = 0;
    
    if (event === 'CRYING DETECTED! ⚠️') {
      event = 'CRYING';
      eventCode = 4;
    } else if (event === 'Restless') {
      event = 'RESTLESS';
      eventCode = 3;
    } else if (event === 'Light Activity') {
      event = 'LIGHT_ACTIVITY';
      eventCode = 2;
    } else if (event === 'Quiet') {
      event = 'QUIET';
      eventCode = 1;
    } else {
      // Fallback calculation using thresholds
      if (level >= CONFIG.soundThresholds.CRYING) {
        event = 'CRYING';
        eventCode = 4;
      } else if (level >= CONFIG.soundThresholds.RESTLESS) {
        event = 'RESTLESS';
        eventCode = 3;
      } else if (level >= CONFIG.soundThresholds.LIGHT_ACTIVITY) {
        event = 'LIGHT_ACTIVITY';
        eventCode = 2;
      } else if (level >= CONFIG.soundThresholds.QUIET) {
        event = 'QUIET';
        eventCode = 1;
      }
    }
    
    // Track event duration
    if (event !== this.currentEvent) {
      this.eventStartTime = Date.now();
      this.currentEvent = event;
    }
    
    const eventDuration = Date.now() - this.eventStartTime;
    
    return {
      level: Math.round(level),
      smoothed_level: Math.round(smoothedLevel),
      percentage: percentage,
      raw,
      diff,
      baseline: this.baseline,
      sensitivity,
      calibrated: this.calibrated,
      digital: digital,
      event,
      event_code: eventCode,
      event_duration: eventDuration,
      peak: this.peakValue,
      peak_detected: this.peakDetected,
      energy: Math.round(this.energyLevel),
      stability: this.calculateStability(),
      trend: this.calculateTrend(),
      volatility: this.calculateVolatility(),
      thresholds: {
        quiet: data.quiet_threshold || 6,
        light_activity: data.light_activity_threshold || 20,
        restless: data.restless_threshold || 40
      }
    };
  }
  
  calculateStability() {
    if (this.history.length < 5) return 100;
    const recent = this.history.slice(-10);
    const mean = recent.reduce((a, b) => a + b, 0) / recent.length;
    const variance = recent.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / recent.length;
    const stdDev = Math.sqrt(variance);
    return Math.max(0, Math.min(100, 100 - (stdDev * 2)));
  }
  
  calculateTrend() {
    if (this.history.length < 10) return 'stable';
    const recent = this.history.slice(-5);
    const older = this.history.slice(-10, -5);
    const recentAvg = recent.reduce((a, b) => a + b, 0) / recent.length;
    const olderAvg = older.reduce((a, b) => a + b, 0) / older.length;
    
    if (recentAvg > olderAvg * 1.2) return 'increasing';
    if (recentAvg < olderAvg * 0.8) return 'decreasing';
    return 'stable';
  }
  
  calculateVolatility() {
    if (this.history.length < 10) return 0;
    const diffs = [];
    for (let i = 1; i < this.history.length; i++) {
      diffs.push(Math.abs(this.history[i] - this.history[i-1]));
    }
    return Math.round(diffs.reduce((a, b) => a + b, 0) / diffs.length);
  }
}

// Store processors per device
const soundProcessors = new Map();

// Enhanced alert system
class AlertSystem {
  constructor() {
    this.lastAlerts = new Map();
  }
  
  shouldAlert(deviceId, eventType, level) {
    const now = Date.now();
    const lastAlert = this.lastAlerts.get(`${deviceId}_${eventType}`);
    
    if (!lastAlert) return true;
    
    let cooldown = CONFIG.alertCooldown;
    if (eventType === 'CRYING') cooldown = 10000;
    if (eventType === 'RESTLESS') cooldown = 5000;
    
    return (now - lastAlert) > cooldown;
  }
  
  recordAlert(deviceId, eventType) {
    this.lastAlerts.set(`${deviceId}_${eventType}`, Date.now());
  }
}

const alertSystem = new AlertSystem();

// Enhanced API endpoints
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'dashboard.html'));
});

// Get all devices with enhanced stats
app.get('/api/devices', (req, res) => {
  const deviceList = [];
  devices.forEach((device, deviceId) => {
    const processor = soundProcessors.get(deviceId);
    const stats = deviceStats.get(deviceId);
    
    deviceList.push({
      deviceId,
      ip: device.info?.ip,
      lastSeen: device.lastSeen,
      connected: device.ws && device.ws.readyState === WebSocket.OPEN,
      rssi: device.info?.rssi,
      latestData: device.data,
      stats: stats || {
        totalReadings: 0,
        motionCount: 0,
        avgSoundLevel: 0,
        peakSoundRecorded: 0,
        currentSoundEvent: 'QUIET'
      },
      soundMetrics: processor ? {
        calibrated: processor.calibrated,
        baseline: processor.baseline,
        currentEvent: processor.currentEvent,
        energy: processor.energyLevel,
        stability: processor.calculateStability(),
        trend: processor.calculateTrend(),
        lastRaw: processor.lastRawValue,
        lastDiff: processor.lastDiffValue
      } : null
    });
  });
  res.json(deviceList);
});

// Get device details with sound analysis
app.get('/api/devices/:deviceId', (req, res) => {
  const { deviceId } = req.params;
  const device = devices.get(deviceId);
  const processor = soundProcessors.get(deviceId);
  
  if (!device) {
    return res.status(404).json({ error: 'Device not found' });
  }
  
  res.json({
    deviceId,
    info: device.info,
    lastSeen: device.lastSeen,
    connected: device.ws && device.ws.readyState === WebSocket.OPEN,
    latestData: device.data,
    stats: deviceStats.get(deviceId) || {
      totalReadings: 0,
      motionCount: 0,
      avgSoundLevel: 0,
      peakSoundRecorded: 0,
      currentSoundEvent: 'QUIET'
    },
    soundAnalysis: processor ? {
      calibrated: processor.calibrated,
      baseline: processor.baseline,
      currentEvent: processor.currentEvent,
      energy: processor.energyLevel,
      stability: processor.calculateStability(),
      trend: processor.calculateTrend(),
      volatility: processor.calculateVolatility(),
      peakDetected: processor.peakDetected,
      peakValue: processor.peakValue,
      lastRaw: processor.lastRawValue,
      lastDiff: processor.lastDiffValue
    } : null,
    history: deviceHistory.get(deviceId) || []
  });
});

// Get sound analysis with advanced metrics
app.get('/api/devices/:deviceId/sound/analysis', (req, res) => {
  const { deviceId } = req.params;
  const processor = soundProcessors.get(deviceId);
  const history = deviceHistory.get(deviceId) || [];
  
  if (!processor) {
    return res.status(404).json({ error: 'No sound data available' });
  }
  
  const recentSound = history.filter(h => h.sound_level !== undefined).slice(-100);
  
  const distribution = {
    QUIET: recentSound.filter(h => h.sound_event === 'QUIET').length,
    LIGHT_ACTIVITY: recentSound.filter(h => h.sound_event === 'LIGHT_ACTIVITY').length,
    RESTLESS: recentSound.filter(h => h.sound_event === 'RESTLESS').length,
    CRYING: recentSound.filter(h => h.sound_event === 'CRYING').length
  };
  
  const timeOfDay = {
    night: { count: 0, sum: 0 },
    morning: { count: 0, sum: 0 },
    afternoon: { count: 0, sum: 0 },
    evening: { count: 0, sum: 0 }
  };
  
  recentSound.forEach(entry => {
    const hour = new Date(entry.timestamp).getHours();
    if (hour >= 22 || hour < 6) {
      timeOfDay.night.count++;
      timeOfDay.night.sum += entry.sound_level;
    } else if (hour >= 6 && hour < 12) {
      timeOfDay.morning.count++;
      timeOfDay.morning.sum += entry.sound_level;
    } else if (hour >= 12 && hour < 18) {
      timeOfDay.afternoon.count++;
      timeOfDay.afternoon.sum += entry.sound_level;
    } else {
      timeOfDay.evening.count++;
      timeOfDay.evening.sum += entry.sound_level;
    }
  });
  
  res.json({
    current: {
      level: processor.history[processor.history.length - 1] || 0,
      raw: processor.lastRawValue,
      diff: processor.lastDiffValue,
      percentage: Math.round(((processor.history[processor.history.length - 1] || 0) / 1023) * 100),
      smoothed: processor.calculateStability(),
      event: processor.currentEvent,
      energy: processor.energyLevel,
      stability: processor.calculateStability(),
      trend: processor.calculateTrend(),
      volatility: processor.calculateVolatility(),
      peak: processor.peakValue,
      baseline: processor.baseline,
      calibrated: processor.calibrated
    },
    statistics: {
      average: recentSound.reduce((sum, h) => sum + (h.sound_level || 0), 0) / (recentSound.length || 1),
      max: Math.max(...recentSound.map(h => h.sound_level || 0), 0),
      min: Math.min(...recentSound.map(h => h.sound_level || 0), 1023),
      distribution,
      samples: recentSound.length
    },
    timeOfDay: {
      night: timeOfDay.night.count > 0 ? timeOfDay.night.sum / timeOfDay.night.count : 0,
      morning: timeOfDay.morning.count > 0 ? timeOfDay.morning.sum / timeOfDay.morning.count : 0,
      afternoon: timeOfDay.afternoon.count > 0 ? timeOfDay.afternoon.sum / timeOfDay.afternoon.count : 0,
      evening: timeOfDay.evening.count > 0 ? timeOfDay.evening.sum / timeOfDay.evening.count : 0
    }
  });
});

// Generic command endpoint
app.post('/api/devices/:deviceId/command', (req, res) => {
  const { deviceId } = req.params;
  const { command, value } = req.body;
  const device = devices.get(deviceId);
  if (!device || !device.ws || device.ws.readyState !== WebSocket.OPEN) {
    return res.status(404).json({ error: 'Device not connected' });
  }
  device.ws.send(JSON.stringify({ type: 'command', command, value, timestamp: Date.now() }));
  res.json({ success: true, command, deviceId });
});

// Sound calibration endpoint
app.post('/api/devices/:deviceId/calibrate', async (req, res) => {
  const { deviceId } = req.params;
  const { duration = 5000 } = req.body;
  
  const device = devices.get(deviceId);
  if (!device || !device.ws || device.ws.readyState !== WebSocket.OPEN) {
    return res.status(404).json({ error: 'Device not connected' });
  }
  
  device.ws.send(JSON.stringify({
    type: 'command',
    command: 'recalibrate_sound',
    timestamp: Date.now()
  }));
  
  const calibrationStart = Date.now();
  
  const checkCalibration = () => {
    const processor = soundProcessors.get(deviceId);
    if (processor && processor.calibrated) {
      res.json({
        success: true,
        message: 'Calibration completed',
        baseline: processor.baseline,
        timestamp: Date.now()
      });
    } else if (Date.now() - calibrationStart > duration + 5000) {
      res.status(408).json({ error: 'Calibration timeout' });
    } else {
      setTimeout(checkCalibration, 500);
    }
  };
  
  setTimeout(checkCalibration, duration);
});

// Auto-tuning endpoint
app.post('/api/devices/:deviceId/auto-tune', async (req, res) => {
  const { deviceId } = req.params;
  const { targetSensitivity = 5 } = req.body;
  
  const device = devices.get(deviceId);
  if (!device || !device.ws || device.ws.readyState !== WebSocket.OPEN) {
    return res.status(404).json({ error: 'Device not connected' });
  }
  
  const processor = soundProcessors.get(deviceId);
  if (!processor || !processor.calibrated) {
    return res.status(400).json({ error: 'Please calibrate the sensor first' });
  }
  
  const history = deviceHistory.get(deviceId) || [];
  const recentSound = history.filter(h => h.sound_level !== undefined).slice(-100);
  
  if (recentSound.length < 10) {
    return res.status(400).json({ error: 'Insufficient data for auto-tuning' });
  }
  
  const avgSound = recentSound.reduce((sum, h) => sum + h.sound_level, 0) / recentSound.length;
  const maxSound = Math.max(...recentSound.map(h => h.sound_level));
  
  let recommendedSensitivity = targetSensitivity;
  
  if (avgSound < 100 && maxSound < 300) {
    recommendedSensitivity = Math.min(CONFIG.sensitivityRange.max, targetSensitivity + 3);
  } else if (avgSound > 500 || maxSound > 900) {
    recommendedSensitivity = Math.max(CONFIG.sensitivityRange.min, targetSensitivity - 2);
  }
  
  device.ws.send(JSON.stringify({
    type: 'command',
    command: 'set_sensitivity',
    value: recommendedSensitivity,
    timestamp: Date.now()
  }));
  
  res.json({
    success: true,
    message: 'Auto-tuning completed',
    current: {
      average_sound: avgSound.toFixed(1),
      max_sound: maxSound,
      recommended_sensitivity: recommendedSensitivity
    }
  });
});

// Enhanced WebSocket handler
wss.on('connection', (ws, req) => {
  const clientIp = req.socket.remoteAddress;
  console.log('🔌 New WebSocket connection from:', clientIp);
  
  let currentDeviceId = null;
  
  ws.on('message', async (message) => {
    try {
      const data = JSON.parse(message);
      
      // Handle device registration
      if (data.type === 'register') {
        currentDeviceId = data.deviceId;
        
        // Initialize sound processor
        if (!soundProcessors.has(currentDeviceId)) {
          soundProcessors.set(currentDeviceId, new SoundProcessor(currentDeviceId));
        }
        
        devices.set(currentDeviceId, {
          ws,
          info: {
            ip: data.ip || clientIp,
            rssi: data.rssi,
            sensitivity: data.sensitivity || CONFIG.sensitivityRange.default,
            sound_calibrated: data.sound_calibrated || false,
            sound_baseline: data.sound_baseline || 0,
            registeredAt: Date.now()
          },
          lastSeen: Date.now(),
          data: {}
        });
        
        if (!deviceHistory.has(currentDeviceId)) {
          deviceHistory.set(currentDeviceId, []);
        }
        
        if (!deviceStats.has(currentDeviceId)) {
          deviceStats.set(currentDeviceId, {
            totalReadings: 0,
            motionCount: 0,
            avgSoundLevel: 0,
            peakSoundRecorded: 0,
            lastMotionTime: 0,
            totalSoundSamples: 0,
            currentSoundEvent: 'QUIET',
            soundEventCount: {
              QUIET: 0,
              LIGHT_ACTIVITY: 0,
              RESTLESS: 0,
              CRYING: 0
            }
          });
        }
        
        if (!soundEvents.has(currentDeviceId)) {
          soundEvents.set(currentDeviceId, []);
        }
        
        if (!soundAlerts.has(currentDeviceId)) {
          soundAlerts.set(currentDeviceId, []);
        }
        
        console.log(`✅ Device registered: ${currentDeviceId}`);
        
        ws.send(JSON.stringify({
          type: 'registered',
          deviceId: currentDeviceId,
          message: 'Device registered successfully',
          thresholds: CONFIG.soundThresholds,
          sensitivityRange: CONFIG.sensitivityRange,
          serverTime: Date.now()
        }));
      }
      
      // Handle sensor data - WITH FORMAT ADAPTATION
      else if (data.type === 'sensor_data' && currentDeviceId) {
        // ADAPT THE DATA FORMAT (new ESP32 format -> legacy format)
        const adaptedData = adaptESP32DataFormat(data);
        
        const device = devices.get(currentDeviceId);
        if (device) {
          device.lastSeen = Date.now();
          
          // Get sound processor
          const processor = soundProcessors.get(currentDeviceId);
          
          // Process sound data
          let processedSound = null;
          if (processor) {
            processedSound = processor.processSoundData(adaptedData);
          }
          
          const soundLevel = adaptedData.sound || 0;
          const percentage = Math.min(100, Math.round((soundLevel / 1023) * 100));

          // ── ML classification (replaces threshold logic) ──────────
          const comfort = (() => {
            const t = adaptedData.temperature || 0;
            const h = adaptedData.humidity || 0;
            const tScore = Math.max(0, 100 - Math.abs(t - 20) * 8);
            const hScore = Math.max(0, 100 - Math.abs(h - 50) * 2.5);
            const sScore = Math.max(0, 100 - (soundLevel / 1023) * 100);
            return Math.round(tScore * 0.35 + hScore * 0.25 + sScore * 0.40);
          })();

          const mlResult = await mlPredictor.predict(currentDeviceId, {
            sound:           soundLevel,
            temp:            adaptedData.temperature || 0,
            humidity:        adaptedData.humidity    || 0,
            light:           adaptedData.light       || 0,
            comfort,
            motion:          adaptedData.motion      || 0,
            motionDurationMs: adaptedData.motion_duration || 0,
          });

          let soundEvent = mlResult.event || 'QUIET';
          
          // Enhanced data storage
          device.data = {
            temperature: adaptedData.temperature,
            humidity: adaptedData.humidity,
            motion: adaptedData.motion,
            motion_count: adaptedData.motion_count,
            motion_duration: adaptedData.motion_duration,
            light: adaptedData.light,
            
            sound_level: soundLevel,
            sound_raw: adaptedData.sound_raw || 0,
            sound_diff: adaptedData.sound_diff || 0,
            sound_baseline: adaptedData.sound_baseline || 0,
            sound_sensitivity: adaptedData.sound_sensitivity || CONFIG.sensitivityRange.default,
            sound_alert: adaptedData.sound_alert || 'QUIET',
            sound_digital: adaptedData.sound_digital || 0,
            sound_calibrated: adaptedData.sound_calibrated || false,
            
            sound_percentage: percentage,
            sound_event: soundEvent,
            ml_source: mlResult.source,
            ml_confidence: mlResult.confidence,
            ml_confidences: mlResult.confidences,
            ml_window_size: mlResult.windowSize,
            sound_peak: processedSound ? processedSound.peak : 0,
            sound_energy: processedSound ? processedSound.energy : 0,
            sound_stability: processedSound ? processedSound.stability : 100,
            sound_trend: processedSound ? processedSound.trend : 'stable',
            sound_volatility: processedSound ? processedSound.volatility : 0,
            
            // New fields from ESP32
            audio_crying: adaptedData._original_crying || false,
            audio_amplitude: adaptedData._original_amplitude || soundLevel,
            alert_level: adaptedData._original_alert_level || 'Quiet',
            
            thresholds: {
              quiet: adaptedData.quiet_threshold || 25,
              light_activity: adaptedData.light_activity_threshold || 80,
              restless: adaptedData.restless_threshold || 200
            },
            
            rssi: adaptedData.rssi,
            free_heap: adaptedData.free_heap,
            timestamp: Date.now()
          };
          
          // Update device info
          if (adaptedData.sound_sensitivity) {
            device.info.sensitivity = adaptedData.sound_sensitivity;
          }
          if (adaptedData.sound_calibrated !== undefined) {
            device.info.sound_calibrated = adaptedData.sound_calibrated;
          }
          if (adaptedData.sound_baseline) {
            device.info.sound_baseline = adaptedData.sound_baseline;
          }
          
          // Update stats
          const stats = deviceStats.get(currentDeviceId);
          stats.totalReadings++;
          stats.avgSoundLevel = (stats.avgSoundLevel * (stats.totalReadings - 1) + soundLevel) / stats.totalReadings;
          stats.currentSoundEvent = soundEvent;
          
          if (soundEvent) {
            stats.soundEventCount[soundEvent] = (stats.soundEventCount[soundEvent] || 0) + 1;
          }
          
          if (soundLevel > stats.peakSoundRecorded) {
            stats.peakSoundRecorded = soundLevel;
          }
          
          if (adaptedData.motion === 1) {
            stats.motionCount++;
            stats.lastMotionTime = Date.now();
            
            logToFile('motion', currentDeviceId, {
              sound_level: soundLevel,
              sound_alert: adaptedData.sound_alert,
              timestamp: Date.now()
            });
          }
          
          // Push to MongoDB batch buffer
          if (dataBuffer) {
            dataBuffer.push(currentDeviceId, {
              ...device.data,
              comfort: device.data.comfort ?? null,
            });
          }
          
          // Store in memory history
          const history = deviceHistory.get(currentDeviceId);
          const historyEntry = {
            ...device.data,
            deviceId: currentDeviceId
          };
          history.push(historyEntry);
          
          if (history.length > CONFIG.maxHistorySize) {
            history.shift();
          }
          
          // Store significant sound events
          if (soundEvent !== 'QUIET') {
            const events = soundEvents.get(currentDeviceId);
            events.push({
              timestamp: Date.now(),
              event: soundEvent,
              level: soundLevel,
              raw: adaptedData.sound_raw,
              diff: adaptedData.sound_diff,
              peak: processedSound ? processedSound.peak : 0,
              alert: adaptedData.sound_alert,
              motion_at_event: adaptedData.motion
            });
            
            if (events.length > CONFIG.maxSoundEvents) {
              events.shift();
            }
            
            // Check for alerts
            if (alertSystem.shouldAlert(currentDeviceId, soundEvent, soundLevel)) {
              alertSystem.recordAlert(currentDeviceId, soundEvent);
              
              const alert = {
                timestamp: Date.now(),
                deviceId: currentDeviceId,
                event: soundEvent,
                level: soundLevel,
                raw: adaptedData.sound_raw,
                diff: adaptedData.sound_diff,
                message: `${adaptedData.sound_alert || soundEvent} Level: ${soundLevel}`
              };
              
              soundAlerts.get(currentDeviceId).push(alert);
              console.log(`🔊 ALERT: ${alert.message}`);
              logToFile('alerts', currentDeviceId, alert);
            }
          }
          
          // Enhanced logging
          const soundBarLength = Math.floor(soundLevel / 40);
          const soundBar = '█'.repeat(Math.min(soundBarLength, 25)) + '░'.repeat(Math.max(0, 25 - soundBarLength));
          let eventIcon = '⚪';
          if (soundEvent === 'CRYING') eventIcon = '🔴';
          else if (soundEvent === 'RESTLESS') eventIcon = '🟡';
          else if (soundEvent === 'LIGHT_ACTIVITY') eventIcon = '🟢';
          
          const mlTag = mlResult.confidence !== null ? `[ML:${mlResult.confidence}%]` : '[TH]';
          console.log(`📊 [${currentDeviceId}] T=${adaptedData.temperature?.toFixed(1)}°C | H=${adaptedData.humidity?.toFixed(1)}% | M=${adaptedData.motion} | S=${percentage}% (${soundLevel}) ${soundBar} ${eventIcon} ${soundEvent} ${mlTag} | L=${adaptedData.light}`);
        }
      }
      
      // Handle heartbeat
      else if (data.type === 'heartbeat' && currentDeviceId) {
        const device = devices.get(currentDeviceId);
        if (device) {
          device.lastSeen = Date.now();
          if (data.rssi) {
            device.info.rssi = data.rssi;
          }
          if (data.sensitivity) {
            device.info.sensitivity = data.sensitivity;
          }
          
          ws.send(JSON.stringify({
            type: 'heartbeat_ack',
            serverTime: Date.now(),
            deviceId: currentDeviceId
          }));
        }
      }
      
    } catch (error) {
      console.error('❌ Error processing message:', error);
      logToFile('errors', currentDeviceId || 'unknown', { error: error.message, stack: error.stack });
    }
  });
  
  ws.on('close', () => {
    if (currentDeviceId) {
      console.log(`🔴 Device disconnected: ${currentDeviceId}`);
      const device = devices.get(currentDeviceId);
      if (device) {
        device.ws = null;
        device.disconnectedAt = Date.now();
      }
      mlPredictor.resetWindow(currentDeviceId);
    }
  });
  
  ws.on('error', (error) => {
    console.error('❌ WebSocket error:', error);
    if (currentDeviceId) {
      logToFile('errors', currentDeviceId, { error: error.message });
    }
  });
});

// Clean up stale devices
setInterval(() => {
  const now = Date.now();
  devices.forEach((device, deviceId) => {
    if (now - device.lastSeen > 60000) {
      if (device.ws && device.ws.readyState === WebSocket.OPEN) {
        device.ws.close();
      }
      console.log(`⚠️ Device ${deviceId} marked as stale`);
    }
  });
}, 30000);

// Generate summary report
setInterval(() => {
  console.log('\n📈 HOURLY SUMMARY REPORT');
  console.log('='.repeat(50));
  
  devices.forEach((device, deviceId) => {
    const stats = deviceStats.get(deviceId);
    const history = deviceHistory.get(deviceId) || [];
    const lastHour = history.filter(h => h.timestamp > Date.now() - 3600000);
    const processor = soundProcessors.get(deviceId);
    
    if (lastHour.length > 0) {
      const avgSound = lastHour.reduce((sum, h) => sum + (h.sound_level || 0), 0) / lastHour.length;
      const peakSound = Math.max(...lastHour.map(h => h.sound_level || 0));
      const motionEvents = lastHour.filter(h => h.motion === 1).length;
      
      const events = {
        QUIET: lastHour.filter(h => h.sound_event === 'QUIET').length,
        LIGHT_ACTIVITY: lastHour.filter(h => h.sound_event === 'LIGHT_ACTIVITY').length,
        RESTLESS: lastHour.filter(h => h.sound_event === 'RESTLESS').length,
        CRYING: lastHour.filter(h => h.sound_event === 'CRYING').length
      };
      
      const avgPercentage = (avgSound / 1023 * 100).toFixed(1);
      const peakPercentage = (peakSound / 1023 * 100).toFixed(1);
      
      console.log(`\nDevice: ${deviceId}`);
      console.log(`  📊 Readings: ${lastHour.length}`);
      console.log(`  🔊 Avg Sound: ${avgPercentage}% (${avgSound.toFixed(0)}) | Peak: ${peakPercentage}% (${peakSound.toFixed(0)})`);
      console.log(`  🎵 Events: Q:${events.QUIET} L:${events.LIGHT_ACTIVITY} R:${events.RESTLESS} C:${events.CRYING}`);
      console.log(`  🔴 Motion: ${motionEvents}`);
      console.log(`  📶 RSSI: ${device.info?.rssi || 'N/A'} dBm`);
      console.log(`  🔧 Sensitivity: ${device.info?.sensitivity || 'N/A'}`);
      
      if (processor) {
        console.log(`  📈 Trend: ${processor.calculateTrend()} | Stability: ${processor.calculateStability().toFixed(1)}%`);
      }
    }
  });
  
  console.log('='.repeat(50));
}, 3600000);

// ── ML status endpoint ────────────────────────────────────────────
app.get('/api/ml/status', (req, res) => {
  res.json(mlPredictor.status());
});

// ── Database API endpoints ────────────────────────────────────────

app.get('/api/db/readings', async (req, res) => {
  try {
    const db = getDb();
    if (!db) {
      return res.status(503).json({ error: 'MongoDB not connected' });
    }
    const deviceId = req.query.deviceId;
    const limit = Math.min(parseInt(req.query.limit || '200', 10), 2000);
    const from = req.query.from ? new Date(req.query.from) : null;
    const to = req.query.to ? new Date(req.query.to) : null;

    const filter = {};
    if (deviceId) filter.deviceId = deviceId;
    if (from || to) {
      filter.ts = {};
      if (from) filter.ts.$gte = from;
      if (to) filter.ts.$lte = to;
    }

    const docs = await db.collection('readings')
      .find(filter, { projection: { _id: 0 } })
      .sort({ ts: -1 })
      .limit(limit)
      .toArray();

    res.json({ count: docs.length, readings: docs });
  } catch (err) {
    console.error('/api/db/readings error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/db/events', async (req, res) => {
  try {
    const db = getDb();
    if (!db) {
      return res.status(503).json({ error: 'MongoDB not connected' });
    }
    const deviceId = req.query.deviceId;
    const category = req.query.category;
    const limit = Math.min(parseInt(req.query.limit || '100', 10), 1000);
    const from = req.query.from ? new Date(req.query.from) : null;
    const to = req.query.to ? new Date(req.query.to) : null;

    const filter = {};
    if (deviceId) filter.deviceId = deviceId;
    if (category) filter.category = category;
    if (from || to) {
      filter.ts = {};
      if (from) filter.ts.$gte = from;
      if (to) filter.ts.$lte = to;
    }

    const events = await db.collection('events')
      .find(filter, { projection: { _id: 0 } })
      .sort({ ts: -1 })
      .limit(limit)
      .toArray();

    res.json({ count: events.length, events });
  } catch (err) {
    console.error('/api/db/events error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/db/stats/hourly', async (req, res) => {
  try {
    const db = getDb();
    if (!db) {
      return res.status(503).json({ error: 'MongoDB not connected' });
    }
    const deviceId = req.query.deviceId;
    const days = Math.min(parseInt(req.query.days || '7', 10), 90);
    const from = new Date(Date.now() - days * 24 * 3600 * 1000);

    const filter = { hour: { $gte: from } };
    if (deviceId) filter.deviceId = deviceId;

    const stats = await db.collection('hourly_stats')
      .find(filter, { projection: { _id: 0 } })
      .sort({ deviceId: 1, hour: 1 })
      .toArray();

    res.json({ count: stats.length, stats });
  } catch (err) {
    console.error('/api/db/stats/hourly error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/db/stats/daily', async (req, res) => {
  try {
    const db = getDb();
    if (!db) {
      return res.status(503).json({ error: 'MongoDB not connected' });
    }
    const deviceId = req.query.deviceId;
    const days = Math.min(parseInt(req.query.days || '30', 10), 365);
    const from = new Date(Date.now() - days * 24 * 3600 * 1000);

    const matchStage = { $match: { hour: { $gte: from } } };
    if (deviceId) matchStage.$match.deviceId = deviceId;

    const pipeline = [
      matchStage,
      {
        $group: {
          _id: {
            deviceId: '$deviceId',
            date: { $dateToString: { format: '%Y-%m-%d', date: '$hour' } },
          },
          tempAvg:   { $avg: '$temp.avg'     },
          tempMin:   { $min: '$temp.min'     },
          tempMax:   { $max: '$temp.max'     },
          humAvg:    { $avg: '$humidity.avg' },
          sndAvg:    { $avg: '$sound.avg'    },
          sndMax:    { $max: '$sound.max'    },
          cftAvg:    { $avg: '$comfort.avg'  },
          mtnTotal:  { $sum: '$motion.totalSamplesActive' },
          mtnEvents: { $sum: '$motion.totalEvents'         },
          hQUIET:          { $sum: '$soundHist.QUIET'          },
          hLIGHT_ACTIVITY: { $sum: '$soundHist.LIGHT_ACTIVITY' },
          hRESTLESS:       { $sum: '$soundHist.RESTLESS'       },
          hCRYING:         { $sum: '$soundHist.CRYING'         },
        },
      },
      { $sort: { '_id.deviceId': 1, '_id.date': 1 } },
      {
        $project: {
          _id:      0,
          deviceId: '$_id.deviceId',
          date:     '$_id.date',
          temp:     { avg: { $round: ['$tempAvg', 2] }, min: '$tempMin', max: '$tempMax' },
          humidity: { avg: { $round: ['$humAvg',  2] } },
          sound:    { avg: { $round: ['$sndAvg',  1] }, max: '$sndMax'  },
          comfort:  { avg: { $round: ['$cftAvg',  1] } },
          motion:   { totalSamples: '$mtnTotal', totalEvents: '$mtnEvents' },
          soundHist: {
            QUIET:          '$hQUIET',
            LIGHT_ACTIVITY: '$hLIGHT_ACTIVITY',
            RESTLESS:       '$hRESTLESS',
            CRYING:         '$hCRYING',
          },
        },
      },
    ];

    const rows = await db.collection('hourly_stats').aggregate(pipeline).toArray();
    res.json({ count: rows.length, days: rows });
  } catch (err) {
    console.error('/api/db/stats/daily error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/db/health', async (req, res) => {
  try {
    const db = getDb();
    if (!db) {
      return res.status(503).json({ status: 'error', message: 'MongoDB not connected' });
    }
    const [readings, events, hourly, meta] = await Promise.all([
      db.collection('readings').estimatedDocumentCount(),
      db.collection('events').estimatedDocumentCount(),
      db.collection('hourly_stats').estimatedDocumentCount(),
      db.collection('devices_meta').estimatedDocumentCount(),
    ]);
    res.json({
      status: 'ok',
      collections: { readings, events, hourly_stats: hourly, devices_meta: meta },
    });
  } catch (err) {
    res.status(503).json({ status: 'error', message: err.message });
  }
});

// ── Server startup ───────────────────────────────────────────
const PORT = process.env.PORT || 3007;

async function startServer() {
  // 1. Connect to MongoDB (non-fatal)
  try {
    await connectMongo();
    if (dataBuffer && dataBuffer.start) {
      dataBuffer.start();
    }
    if (startAggregator) {
      startAggregator();
    }
  } catch (err) {
    console.error('[MongoDB] ⚠️ Could not connect — running without DB persistence:', err.message);
  }

  // 2. Start HTTP + WebSocket server
  server.listen(PORT, '0.0.0.0', () => {
    console.log('\n🚀 Enhanced Greenhouse Monitor Server');
    console.log('='.repeat(50));
    console.log(`📡 WebSocket: ws://localhost:${PORT}`);
    console.log(`🌐 HTTP: http://localhost:${PORT}`);
    console.log('\n📊 API Endpoints:');
    console.log(`   GET  /api/devices - List all devices`);
    console.log(`   GET  /api/devices/:id - Get device details`);
    console.log(`   GET  /api/devices/:id/sound/analysis - Get sound analysis`);
    console.log(`   POST /api/devices/:id/calibrate - Calibrate sound sensor`);
    console.log(`   POST /api/devices/:id/auto-tune - Auto-tune sensitivity`);
    console.log(`   POST /api/devices/:id/command - Send command`);
    console.log(`   GET  /api/db/readings - MongoDB readings`);
    console.log(`   GET  /api/db/events - MongoDB events`);
    console.log(`   GET  /api/db/stats/hourly - Hourly summaries`);
    console.log(`   GET  /api/db/stats/daily - Daily summaries`);
    console.log('='.repeat(50));
    console.log('\n✅ Server ready! Waiting for ESP32 connections...');
  });
}

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('[Server] SIGTERM — shutting down…');
  if (dataBuffer && dataBuffer.drain) {
    await dataBuffer.drain();
  }
  process.exit(0);
});
process.on('SIGINT', async () => {
  console.log('[Server] SIGINT — shutting down…');
  if (dataBuffer && dataBuffer.drain) {
    await dataBuffer.drain();
  }
  process.exit(0);
});

startServer();