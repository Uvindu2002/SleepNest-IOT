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
    QUIET: 6,
    LIGHT_ACTIVITY: 20,
    RESTLESS: 40,
    CRYING: 60
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
      // Additional metrics
      stability: this.calculateStability(),
      trend: this.calculateTrend(),
      volatility: this.calculateVolatility(),
      // ESP32 thresholds for reference
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
    // Lower stdDev = more stable
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
    
    // Different cooldowns for different events
    let cooldown = CONFIG.alertCooldown;
    if (eventType === 'CRYING') cooldown = 10000; // 10 seconds for crying
    if (eventType === 'RESTLESS') cooldown = 5000; // 5 seconds for restless
    
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
  
  // Calculate sound distribution over time
  const distribution = {
    QUIET: recentSound.filter(h => h.sound_event === 'QUIET').length,
    LIGHT_ACTIVITY: recentSound.filter(h => h.sound_event === 'LIGHT_ACTIVITY').length,
    RESTLESS: recentSound.filter(h => h.sound_event === 'RESTLESS').length,
    CRYING: recentSound.filter(h => h.sound_event === 'CRYING').length
  };
  
  // Calculate average by time of day
  const timeOfDay = {
    night: { count: 0, sum: 0 }, // 22-6
    morning: { count: 0, sum: 0 }, // 6-12
    afternoon: { count: 0, sum: 0 }, // 12-18
    evening: { count: 0, sum: 0 } // 18-22
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

// Generic command endpoint (used by frontend Settings page)
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
  const { duration = 5000 } = req.body; // Calibration duration in ms
  
  const device = devices.get(deviceId);
  if (!device || !device.ws || device.ws.readyState !== WebSocket.OPEN) {
    return res.status(404).json({ error: 'Device not connected' });
  }
  
  // Send calibration command
  device.ws.send(JSON.stringify({
    type: 'command',
    command: 'recalibrate_sound',
    timestamp: Date.now()
  }));
  
  // Store calibration start time
  const calibrationStart = Date.now();
  
  // Wait for calibration to complete
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
  
  // Analyze recent sound levels to determine optimal sensitivity
  const history = deviceHistory.get(deviceId) || [];
  const recentSound = history.filter(h => h.sound_level !== undefined).slice(-100);
  
  if (recentSound.length < 10) {
    return res.status(400).json({ error: 'Insufficient data for auto-tuning' });
  }
  
  const avgSound = recentSound.reduce((sum, h) => sum + h.sound_level, 0) / recentSound.length;
  const maxSound = Math.max(...recentSound.map(h => h.sound_level));
  
  // Calculate recommended sensitivity
  let recommendedSensitivity = targetSensitivity;
  
  if (avgSound < 100 && maxSound < 300) {
    // Too quiet, increase sensitivity
    recommendedSensitivity = Math.min(CONFIG.sensitivityRange.max, targetSensitivity + 3);
  } else if (avgSound > 500 || maxSound > 900) {
    // Too sensitive, decrease sensitivity
    recommendedSensitivity = Math.max(CONFIG.sensitivityRange.min, targetSensitivity - 2);
  }
  
  // Send sensitivity command
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
  
  ws.on('message', (message) => {
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
      
      // Handle sensor data with enhanced sound processing
      else if (data.type === 'sensor_data' && currentDeviceId) {
        const device = devices.get(currentDeviceId);
        if (device) {
          device.lastSeen = Date.now();
          
          // Get sound processor
          const processor = soundProcessors.get(currentDeviceId);
          
          // Process sound data from ESP32 format
          let processedSound = null;
          if (processor) {
            processedSound = processor.processSoundData(data);
          }
          
          // Enhanced data storage - preserve all ESP32 fields
          device.data = {
            // Basic sensor data
            temperature: data.temperature,
            humidity: data.humidity,
            motion: data.motion,
            motion_count: data.motion_count,
            motion_duration: data.motion_duration,
            light: data.light,
            
            // Sound data - all ESP32 fields preserved
            sound_level: data.sound || 0,
            sound_raw: data.sound_raw || 0,
            sound_diff: data.sound_diff || 0,
            sound_baseline: data.sound_baseline || 0,
            sound_sensitivity: data.sound_sensitivity || CONFIG.sensitivityRange.default,
            sound_alert: data.sound_alert || 'QUIET',
            sound_digital: data.sound_digital || 0,
            sound_calibrated: data.sound_calibrated || false,
            
            // Processed data
            sound_percentage: processedSound ? processedSound.percentage : 0,
            sound_event: processedSound ? processedSound.event : data.sound_alert || 'QUIET',
            sound_peak: processedSound ? processedSound.peak : 0,
            sound_energy: processedSound ? processedSound.energy : 0,
            sound_stability: processedSound ? processedSound.stability : 100,
            sound_trend: processedSound ? processedSound.trend : 'stable',
            sound_volatility: processedSound ? processedSound.volatility : 0,
            
            // Thresholds from ESP32
            thresholds: {
              quiet: data.quiet_threshold || 6,
              light_activity: data.light_activity_threshold || 20,
              restless: data.restless_threshold || 40
            },
            
            // Additional metrics
            rssi: data.rssi,
            free_heap: data.free_heap,
            timestamp: Date.now()
          };
          
          // Update device info
          device.info.sensitivity = data.sound_sensitivity || device.info.sensitivity;
          device.info.sound_calibrated = data.sound_calibrated || device.info.sound_calibrated;
          device.info.sound_baseline = data.sound_baseline || device.info.sound_baseline;
          
          // Update stats
          const stats = deviceStats.get(currentDeviceId);
          stats.totalReadings++;
          const soundLevel = data.sound || 0;
          stats.avgSoundLevel = (stats.avgSoundLevel * (stats.totalReadings - 1) + soundLevel) / stats.totalReadings;
          stats.currentSoundEvent = device.data.sound_event;
          
          if (device.data.sound_event) {
            stats.soundEventCount[device.data.sound_event] = (stats.soundEventCount[device.data.sound_event] || 0) + 1;
          }
          
          if (soundLevel > stats.peakSoundRecorded) {
            stats.peakSoundRecorded = soundLevel;
          }
          
          if (data.motion === 1) {
            stats.motionCount++;
            stats.lastMotionTime = Date.now();
            
            // Log motion with sound context
            logToFile('motion', currentDeviceId, {
              sound_level: soundLevel,
              sound_alert: data.sound_alert,
              timestamp: Date.now()
            });
          }
          
          // ── Push to MongoDB batch buffer (non-blocking) ────────
          dataBuffer.push(currentDeviceId, {
            ...device.data,
            comfort: device.data.comfort ?? null, // comfort computed in frontend; keep null if not available
          });

          // Store in memory history (for real-time API / charts)
          const history = deviceHistory.get(currentDeviceId);
          const historyEntry = {
            ...device.data,
            deviceId: currentDeviceId
          };
          history.push(historyEntry);
          
          // Keep only last N data points
          if (history.length > CONFIG.maxHistorySize) {
            history.shift();
          }
          
          // Store significant sound events
          if (device.data.sound_event && device.data.sound_event !== 'QUIET') {
            const events = soundEvents.get(currentDeviceId);
            events.push({
              timestamp: Date.now(),
              event: device.data.sound_event,
              level: soundLevel,
              raw: data.sound_raw,
              diff: data.sound_diff,
              peak: processedSound ? processedSound.peak : 0,
              alert: data.sound_alert,
              motion_at_event: data.motion
            });
            
            // Keep only last N events
            if (events.length > CONFIG.maxSoundEvents) {
              events.shift();
            }
            
            // Check if we should alert
            if (alertSystem.shouldAlert(currentDeviceId, device.data.sound_event, soundLevel)) {
              alertSystem.recordAlert(currentDeviceId, device.data.sound_event);
              
              const alert = {
                timestamp: Date.now(),
                deviceId: currentDeviceId,
                event: device.data.sound_event,
                level: soundLevel,
                raw: data.sound_raw,
                diff: data.sound_diff,
                message: `${device.data.sound_alert} Level: ${soundLevel} (Raw: ${data.sound_raw}, Diff: ${data.sound_diff})`
              };
              
              soundAlerts.get(currentDeviceId).push(alert);
              console.log(`🔊 ALERT: ${alert.message}`);
              
              // Log alert
              logToFile('alerts', currentDeviceId, alert);
            }
          }
          
          // Enhanced logging with visual representation
          const soundBarLength = Math.floor(soundLevel / 40); // 0-1023 -> 0-25 bars
          const soundBar = '█'.repeat(Math.min(soundBarLength, 25)) + '░'.repeat(Math.max(0, 25 - soundBarLength));
          let eventIcon = '⚪';
          if (device.data.sound_event === 'CRYING') eventIcon = '🔴';
          else if (device.data.sound_event === 'RESTLESS') eventIcon = '🟡';
          else if (device.data.sound_event === 'LIGHT_ACTIVITY') eventIcon = '🟢';
          
          const percentage = Math.round((soundLevel / 1023) * 100);
          console.log(`📊 [${currentDeviceId}] T=${data.temperature?.toFixed(1)}°C | H=${data.humidity?.toFixed(1)}% | M=${data.motion} | S=${percentage}% (${soundLevel}) ${soundBar} ${eventIcon} ${device.data.sound_event} | Raw:${data.sound_raw} Diff:${data.sound_diff} | L=${data.light}`);
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
        console.log(`  📊 Raw Values: Last Raw=${processor.lastRawValue} | Last Diff=${processor.lastDiffValue}`);
      }
    }
  });
  
  console.log('='.repeat(50));
}, 3600000);

// ─────────────────────────────────────────────────────────────────
// ── Database API endpoints ────────────────────────────────────────
// ─────────────────────────────────────────────────────────────────

/**
 * GET /api/db/readings?deviceId=X&limit=200&from=ISO&to=ISO
 * Returns batched reading docs from MongoDB (newest first).
 * Each doc covers ~30 s of data.
 */
app.get('/api/db/readings', async (req, res) => {
  try {
    const db       = getDb();
    const deviceId = req.query.deviceId;
    const limit    = Math.min(parseInt(req.query.limit  || '200', 10), 2000);
    const from     = req.query.from ? new Date(req.query.from) : null;
    const to       = req.query.to   ? new Date(req.query.to)   : null;

    const filter = {};
    if (deviceId) filter.deviceId = deviceId;
    if (from || to) {
      filter.ts = {};
      if (from) filter.ts.$gte = from;
      if (to)   filter.ts.$lte = to;
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

/**
 * GET /api/db/events?deviceId=X&category=sound|motion&limit=100&from=ISO&to=ISO
 * Returns state-change events (motion start/end, sound alerts) from MongoDB.
 */
app.get('/api/db/events', async (req, res) => {
  try {
    const db       = getDb();
    const deviceId = req.query.deviceId;
    const category = req.query.category; // 'sound' | 'motion' | undefined
    const limit    = Math.min(parseInt(req.query.limit || '100', 10), 1000);
    const from     = req.query.from ? new Date(req.query.from) : null;
    const to       = req.query.to   ? new Date(req.query.to)   : null;

    const filter = {};
    if (deviceId) filter.deviceId = deviceId;
    if (category) filter.category = category;
    if (from || to) {
      filter.ts = {};
      if (from) filter.ts.$gte = from;
      if (to)   filter.ts.$lte = to;
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

/**
 * GET /api/db/stats/hourly?deviceId=X&days=7
 * Returns hourly aggregated stats for trend charts (up to `days` days back).
 * Sorted oldest-first so charts can render left-to-right.
 */
app.get('/api/db/stats/hourly', async (req, res) => {
  try {
    const db       = getDb();
    const deviceId = req.query.deviceId;
    const days     = Math.min(parseInt(req.query.days || '7', 10), 90);
    const from     = new Date(Date.now() - days * 24 * 3600 * 1000);

    // hourly_stats uses 'hour' as the date field, not 'ts'
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

/**
 * GET /api/db/stats/daily?deviceId=X&days=30
 * Returns per-day summaries by aggregating hourly_stats.
 * Useful for the Sleep page "7-day quality" chart.
 */
app.get('/api/db/stats/daily', async (req, res) => {
  try {
    const db       = getDb();
    const deviceId = req.query.deviceId;
    const days     = Math.min(parseInt(req.query.days || '30', 10), 365);
    const from     = new Date(Date.now() - days * 24 * 3600 * 1000);

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

/**
 * GET /api/db/health
 * Quick check: MongoDB connection status + collection counts.
 */
app.get('/api/db/health', async (req, res) => {
  try {
    const db = getDb();
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

// ─────────────────────────────────────────────────────────────────
// ── Server startup — connect MongoDB first, then listen ───────────
// ─────────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 3007;

async function startServer() {
  // 1. Connect to MongoDB (non-fatal: server keeps running if Mongo is down)
  try {
    await connectMongo();
    dataBuffer.start();     // begin 30-second batch flush timer
    startAggregator();      // hourly stats aggregation job
  } catch (err) {
    console.error('[MongoDB] ⚠️  Could not connect — running without DB persistence:', err.message);
    console.error('[MongoDB]    Set MONGO_URI in .env to enable persistence.');
  }

  // 2. Start HTTP + WebSocket server
  server.listen(PORT, '0.0.0.0', startServerCallback);
}

function startServerCallback() {
  console.log('\n🚀 Enhanced Greenhouse Monitor Server');
  console.log('='.repeat(50));
  console.log(`📡 WebSocket: ws://localhost:${PORT}`);
  console.log(`🌐 HTTP: http://localhost:${PORT}`);
  console.log('\n📊 Enhanced API Endpoints:');
  console.log(`   GET  /api/devices - List all devices`);
  console.log(`   GET  /api/devices/:id - Get device details`);
  console.log(`   GET  /api/devices/:id/sound/analysis - Get sound analysis`);
  console.log(`   GET  /api/devices/:id/history - Get device history`);
  console.log(`   POST /api/devices/:id/calibrate - Calibrate sound sensor`);
  console.log(`   POST /api/devices/:id/auto-tune - Auto-tune sensitivity`);
  console.log(`   POST /api/devices/:id/command - Send command`);
  console.log(`   POST /api/broadcast - Broadcast to all devices`);
  console.log(`   GET  /api/stats - Server statistics`);
  console.log('='.repeat(50));
  console.log('\n🔧 Sound Tuning Guide:');
  console.log('   1. Calibrate first: POST /api/devices/:id/calibrate');
  console.log('   2. Auto-tune: POST /api/devices/:id/auto-tune');
  console.log('   3. Manual sensitivity: POST /api/devices/:id/command {"command":"set_sensitivity","value":5}');
  console.log('   4. Monitor sound levels in real-time');
  console.log('   5. Adjust thresholds in CONFIG.soundThresholds as needed');
  console.log('\n💡 ESP32 Data Format:');
  console.log(`   - sound: ${CONFIG.soundThresholds.QUIET}-1023 (level)`);
  console.log(`   - sound_raw: 0-4095 (ADC value)`);
  console.log(`   - sound_diff: difference from baseline`);
  console.log(`   - sound_alert: "Quiet", "Light Activity", "Restless", "CRYING DETECTED! ⚠️"`);
  console.log('\n🎯 Threshold Guide (ESP32 scale 0-1023):');
  console.log(`   QUIET: < ${CONFIG.soundThresholds.QUIET} - Normal ambient`);
  console.log(`   LIGHT_ACTIVITY: ${CONFIG.soundThresholds.QUIET}-${CONFIG.soundThresholds.LIGHT_ACTIVITY} - Soft sounds`);
  console.log(`   RESTLESS: ${CONFIG.soundThresholds.LIGHT_ACTIVITY}-${CONFIG.soundThresholds.RESTLESS} - Moderate activity`);
  console.log(`   CRYING: > ${CONFIG.soundThresholds.RESTLESS} - Loud/urgent sounds`);
  console.log('\n🗄️  MongoDB API:');
  console.log(`   GET  /api/db/readings        - Batched 30s reading docs (TTL 7d)`);
  console.log(`   GET  /api/db/events          - State-change events (permanent)`);
  console.log(`   GET  /api/db/stats/hourly    - Hourly summaries`);
  console.log(`   GET  /api/db/stats/daily     - Daily summaries`);
  console.log(`   GET  /api/db/health          - DB connection health`);
  console.log('='.repeat(50));
}

// ── Graceful shutdown ────────────────────────────────────────────
process.on('SIGTERM', async () => {
  console.log('[Server] SIGTERM — draining buffer and shutting down…');
  await dataBuffer.drain();
  process.exit(0);
});
process.on('SIGINT', async () => {
  console.log('[Server] SIGINT — draining buffer and shutting down…');
  await dataBuffer.drain();
  process.exit(0);
});

// ── Boot ─────────────────────────────────────────────────────────
startServer();