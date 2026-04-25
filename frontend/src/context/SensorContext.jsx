import { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react'
import { calcComfort, comfortStatus, soundToDb, soundEventLabel } from '../utils/comfort'

const Ctx = createContext(null)
export const useSensor = () => useContext(Ctx)

const MAX_HIST = 60
const MAX_TL   = 20
const MAX_LOG  = 100

export function SensorProvider({ children }) {
  const [device,         setDevice]         = useState(null)
  const [connected,      setConnected]      = useState(false)
  const [tempHistory,    setTempHistory]    = useState([])
  const [noiseHistory,   setNoiseHistory]   = useState([])
  const [motionHistory,  setMotionHistory]  = useState([])
  const [timeline,       setTimeline]       = useState([])
  const [alertLog,       setAlertLog]       = useState([])
  const [soundDist,      setSoundDist]      = useState({ QUIET: 0, LIGHT_ACTIVITY: 0, RESTLESS: 0, CRYING: 0 })
  const [dark,           setDark]           = useState(false)
  const [localHistory,   setLocalHistory]   = useState([])   // for History page
  const [motionCount,    setMotionCount]    = useState(0)    // session motion event counter
  const [motionThreshold, setMotionThreshold] = useState(15000) // ms; configurable via Settings

  const lastMotion = useRef(null)
  const lastSoundE = useRef(null)
  const readings   = useRef(0)

  const toggleDark = useCallback(() => setDark(d => !d), [])

  const poll = useCallback(async () => {
    try {
      const res = await fetch('/api/devices')
      if (!res.ok) return
      const list = await res.json()
      if (!list.length) { setConnected(false); setDevice(null); return }

      const dev = list[0]
      setDevice(dev)
      setConnected(dev.connected ?? false)

      const raw       = dev.latestData || {}
      const temp      = raw.temperature ?? null
      const humidity  = raw.humidity    ?? null
      const soundLv   = raw.sound_level ?? 0
      const soundPct  = raw.sound_percentage ?? Math.round((soundLv / 1023) * 100)
      const soundEvt  = raw.sound_event || 'QUIET'
      const motion    = raw.motion
      const now       = Date.now()

      readings.current++

      // Rolling histories
      setTempHistory   (h => [...h, { ts: now, val: temp  ?? 0 }].slice(-MAX_HIST))
      setNoiseHistory  (h => [...h, { ts: now, val: soundPct }].slice(-MAX_HIST))
      setMotionHistory (h => [...h, { ts: now, val: motion === 1 ? 1 : 0 }].slice(-MAX_HIST))

      // Sound distribution
      setSoundDist(d => ({ ...d, [soundEvt]: (d[soundEvt] || 0) + 1 }))

      // Motion duration from device (ms while motion is active)
      const motionDurMs = raw.motion_duration ?? 0

      // Local history row (for History page)
      setLocalHistory(h => [{
        ts: now, temp, humidity, soundLv, soundPct,
        soundEvt, motion, light: raw.light,
        comfort: calcComfort(temp, humidity, soundLv),
      }, ...h].slice(0, 500))

      // Timeline events
      const events = []
      if (motion === 1 && lastMotion.current !== 1) {
        events.push({
          id: `${now}_motion`, ts: now, type: 'motion',
          event: 'Motion detected',
          cause: `Sound: ${soundEvt.replace('_', ' ')} (${soundToDb(soundLv)} dB)`,
        })
        setMotionCount(c => c + 1)
      }
      if ((soundEvt === 'CRYING' || soundEvt === 'RESTLESS') && lastSoundE.current !== soundEvt) {
        events.push({
          id: `${now}_sound`, ts: now, type: 'sound',
          event: soundEvt === 'CRYING' ? '😭 Crying detected' : '😟 Restless detected',
          cause: `Level: ${soundLv} · ${soundToDb(soundLv)} dB`,
        })
        // Alert log entry
        setAlertLog(al => [{
          id: now, ts: now, event: soundEvt,
          level: soundLv, db: soundToDb(soundLv),
          deviceId: dev.deviceId,
        }, ...al].slice(0, MAX_LOG))
      }

      lastMotion.current = motion
      lastSoundE.current = soundEvt

      if (events.length)
        setTimeline(tl => [...events, ...tl].slice(0, MAX_TL))

    } catch { /* silent */ }
  }, [])

  useEffect(() => {
    poll()
    const id = setInterval(poll, 2000)
    return () => clearInterval(id)
  }, [poll])

  // Apply dark class to <html>
  useEffect(() => {
    document.documentElement.classList.toggle('dark', dark)
  }, [dark])

  // --- Derived values from latest data ---
  const raw            = device?.latestData || {}
  const temp           = raw.temperature ?? null
  const humidity       = raw.humidity    ?? null
  const soundLevel     = raw.sound_level ?? 0
  const soundEvent     = raw.sound_event || 'QUIET'
  const mlConfidence   = raw.ml_confidence ?? null
  const mlSource       = raw.ml_source    ?? 'threshold'
  const motion         = raw.motion
  const light          = raw.light       ?? 0
  const motionDurationMs = motion === 1 ? (raw.motion_duration ?? 0) : 0

  // Motion penalty: 0 if no motion, 5 if brief, 25 if sustained ≥ threshold
  const motionExceeded = motion === 1 && motionDurationMs >= motionThreshold
  const motionPenalty  = motion !== 1 ? 0 : motionExceeded ? 25 : 5

  const comfort    = calcComfort(temp, humidity, soundLevel, motionPenalty)
  const statusMsg  = comfortStatus(comfort)
  const db         = soundToDb(soundLevel)
  const soundLabel = soundEventLabel(soundEvent)

  const value = {
    device, connected, raw,
    temp, humidity, soundLevel, soundEvent, mlConfidence, mlSource, motion, light, db,
    comfort, statusMsg, soundLabel,
    motionDurationMs, motionThreshold, setMotionThreshold, motionExceeded, motionPenalty,
    tempHistory, noiseHistory, motionHistory, timeline, alertLog, soundDist,
    localHistory, setLocalHistory, readings: readings.current,
    motionCount,
    dark, toggleDark,
    setAlertLog, setTimeline,
    poll,
  }

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}
