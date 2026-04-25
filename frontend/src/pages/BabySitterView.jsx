import { useState, useEffect } from 'react'
import { useSensor } from '../context/SensorContext'
import { comfortEmoji } from '../utils/comfort'
import { fmtTemp, fmtHum } from '../utils/format'

/* ── Theme by state ─────────────────────────────────────────────── */
function getTheme(comfort, soundEvent, motion) {
  if (soundEvent === 'CRYING')
    return {
      grad:    'from-red-100 via-rose-50 to-pink-100',
      gradDark:'dark:from-[#2A0808] dark:via-[#2A0A0A] dark:to-[#200810]',
      ring:    '#EF4444',
      track:   'rgba(239,68,68,0.15)',
      glow:    'rgba(239,68,68,0.35)',
      badge:   'bg-red-500 text-white',
      border:  'border-red-200 dark:border-red-800/40',
      label:   '🚨 Needs Attention!',
      pulse:   true,
    }
  if (soundEvent === 'RESTLESS' || motion === 1)
    return {
      grad:    'from-amber-100 via-yellow-50 to-orange-100',
      gradDark:'dark:from-[#271A06] dark:via-[#2E2008] dark:to-[#271608]',
      ring:    '#F59E0B',
      track:   'rgba(245,158,11,0.15)',
      glow:    'rgba(245,158,11,0.30)',
      badge:   'bg-amber-500 text-white',
      border:  'border-amber-200 dark:border-amber-700/40',
      label:   '⚠️ May Need Attention',
      pulse:   false,
    }
  if (comfort >= 70)
    return {
      grad:    'from-emerald-100 via-green-50 to-teal-100',
      gradDark:'dark:from-[#0D2419] dark:via-[#112B1E] dark:to-[#0F2A1A]',
      ring:    '#3B9E72',
      track:   'rgba(59,158,114,0.15)',
      glow:    'rgba(59,158,114,0.30)',
      badge:   'bg-emerald-500 text-white',
      border:  'border-emerald-200 dark:border-emerald-800/40',
      label:   '😴 Resting Well',
      pulse:   false,
    }
  return {
    grad:    'from-violet-100 via-indigo-50 to-blue-100',
    gradDark:'dark:from-[#0C1228] dark:via-[#0F1630] dark:to-[#0D1228]',
    ring:    '#5A52E0',
    track:   'rgba(90,82,224,0.15)',
    glow:    'rgba(90,82,224,0.30)',
    badge:   'bg-indigo-500 text-white',
    border:  'border-indigo-200 dark:border-indigo-800/40',
    label:   '🌙 Monitoring',
    pulse:   false,
  }
}

/* ── Alert config ───────────────────────────────────────────────── */
const ALERT = {
  CRYING:   { icon: '🚨', text: 'Baby is crying! Please check immediately.',        bg: 'bg-red-50 dark:bg-red-900/20',       border: 'border-red-300 dark:border-red-800',       txt: 'text-red-700 dark:text-red-300',       dot: 'bg-red-500'    },
  RESTLESS: { icon: '😟', text: 'Baby seems restless. May need attention.',          bg: 'bg-amber-50 dark:bg-amber-900/20',   border: 'border-amber-300 dark:border-amber-800',   txt: 'text-amber-700 dark:text-amber-300',   dot: 'bg-amber-500'  },
  MOTION:   { icon: '🔴', text: 'Movement detected. Baby may be waking up.',         bg: 'bg-orange-50 dark:bg-orange-900/20', border: 'border-orange-300 dark:border-orange-800', txt: 'text-orange-700 dark:text-orange-300', dot: 'bg-orange-500' },
  LOW:      { icon: '⚠️', text: 'Comfort score is low. Check room conditions.',     bg: 'bg-yellow-50 dark:bg-yellow-900/20', border: 'border-yellow-300 dark:border-yellow-800', txt: 'text-yellow-700 dark:text-yellow-300', dot: 'bg-yellow-500' },
  OK:       { icon: '✅', text: 'All conditions are optimal. Baby is resting comfortably.', bg: 'bg-emerald-50 dark:bg-emerald-900/20', border: 'border-emerald-200 dark:border-emerald-800', txt: 'text-emerald-700 dark:text-emerald-300', dot: 'bg-emerald-500' },
}
function getAlert(soundEvent, motion, comfort) {
  if (soundEvent === 'CRYING')   return ALERT.CRYING
  if (soundEvent === 'RESTLESS') return ALERT.RESTLESS
  if (motion === 1)              return ALERT.MOTION
  if (comfort < 50)              return ALERT.LOW
  return ALERT.OK
}

/* ── Comfort arc (SVG) ──────────────────────────────────────────── */
function ComfortArc({ pct, color, track, glow }) {
  const R = 70, SW = 10
  const size = (R + SW) * 2
  const circ = 2 * Math.PI * R
  const arc  = (pct / 100) * circ * 0.75
  const offset = circ * 0.125

  return (
    <svg width={size} height={size} style={{ transform: 'rotate(135deg)' }}>
      <circle cx={size/2} cy={size/2} r={R}
        fill="none" stroke={track} strokeWidth={SW}
        strokeDasharray={`${circ*0.75} ${circ}`}
        strokeDashoffset={-offset} strokeLinecap="round"
      />
      <circle cx={size/2} cy={size/2} r={R}
        fill="none" stroke={color} strokeWidth={SW}
        strokeDasharray={`${arc} ${circ}`}
        strokeDashoffset={-offset} strokeLinecap="round"
        style={{
          transition: 'stroke-dasharray 1s ease',
          filter: `drop-shadow(0 0 6px ${glow})`,
        }}
      />
    </svg>
  )
}

/* ── Metric card ────────────────────────────────────────────────── */
function MetricCard({ emoji, value, label, sub, gradFrom, gradTo, valColor }) {
  return (
    <div className={`rounded-2xl border border-white/70 dark:border-[#2A2E4A] p-4 flex flex-col items-center justify-center text-center shadow-md transition-colors bg-gradient-to-br ${gradFrom} ${gradTo}`}>
      <div className="text-3xl mb-2 leading-none">{emoji}</div>
      <div className="text-xl font-extrabold leading-tight" style={{ color: valColor }}>{value}</div>
      <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 font-medium">{label}</div>
      {sub && <div className="text-[10px] text-gray-400 mt-0.5">{sub}</div>}
    </div>
  )
}

/* ── Live clock ─────────────────────────────────────────────────── */
function LiveClock() {
  const [time, setTime] = useState(new Date())
  useEffect(() => {
    const t = setInterval(() => setTime(new Date()), 1000)
    return () => clearInterval(t)
  }, [])
  return (
    <span className="text-sm font-semibold text-gray-500 dark:text-gray-400 tabular-nums">
      {time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
    </span>
  )
}

/* ── Page ───────────────────────────────────────────────────────── */
export default function BabySitterView() {
  const { comfort, statusMsg, temp, humidity, soundLevel, soundEvent, soundLabel, mlConfidence, mlSource, motion, db, light } = useSensor()

  const theme = getTheme(comfort, soundEvent, motion)
  const alert = getAlert(soundEvent, motion, comfort)
  const emoji = comfortEmoji(comfort)

  return (
    <div className="flex flex-col gap-4">

      {/* ── Header bar ──────────────────────────────────────────── */}
      <div className="flex items-center gap-3">
        <span className="text-xl font-extrabold text-gray-800 dark:text-gray-100 tracking-tight">
          👁️ Baby Sitter View
        </span>
        <div className="flex items-center gap-1.5 ml-2">
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 live-dot inline-block shadow shadow-emerald-300" />
          <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400">Live</span>
        </div>
        <div className="ml-auto">
          <LiveClock />
        </div>
      </div>

      {/* ── Main grid ───────────────────────────────────────────── */}
      <div className="grid gap-4" style={{ gridTemplateColumns: '1.1fr 0.9fr' }}>

        {/* ═══ LEFT: Hero comfort card ════════════════════════════ */}
        <div
          className={`relative overflow-hidden rounded-3xl border-2 flex flex-col items-center justify-center p-8 text-center bg-gradient-to-br ${theme.grad} ${theme.gradDark} ${theme.border} transition-all duration-700 min-h-[420px]`}
        >
          {/* Decorative blobs */}
          <div className="pointer-events-none absolute -top-16 -right-16 w-64 h-64 rounded-full opacity-30 blur-3xl" style={{ background: theme.ring }} />
          <div className="pointer-events-none absolute -bottom-12 -left-12 w-48 h-48 rounded-full opacity-20 blur-3xl" style={{ background: theme.ring }} />

          {/* Status badge */}
          <span className={`relative z-10 text-sm font-bold px-4 py-1.5 rounded-full mb-5 shadow-md ${theme.badge}`}>
            {theme.label}
          </span>

          {/* Arc + emoji stacked */}
          <div className="relative z-10 flex items-center justify-center mb-4">
            <ComfortArc pct={comfort} color={theme.ring} track={theme.track} glow={theme.glow} />
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span
                className="text-[80px] leading-none select-none"
                style={theme.pulse ? {
                  filter: `drop-shadow(0 0 16px ${theme.ring}99)`,
                  animation: 'pulse-dot 1.2s infinite',
                } : {}}
              >
                {emoji}
              </span>
            </div>
          </div>

          {/* Status message */}
          <div className="relative z-10 text-xl font-extrabold text-gray-800 dark:text-gray-100 mb-2 leading-tight">
            {statusMsg}
          </div>

          {/* Score number */}
          <div
            className="relative z-10 text-7xl font-black leading-none mb-1 tabular-nums"
            style={{ color: theme.ring, textShadow: `0 0 30px ${theme.glow}` }}
          >
            {comfort}
          </div>
          <div className="relative z-10 text-sm text-gray-500 dark:text-gray-400 font-medium mb-5">
            Comfort Score / 100
          </div>

          {/* Progress bar */}
          <div className="relative z-10 w-full max-w-[220px] h-3 rounded-full overflow-hidden" style={{ background: theme.track }}>
            <div
              className="h-full rounded-full transition-all duration-700"
              style={{ width: `${comfort}%`, background: theme.ring, boxShadow: `0 0 8px ${theme.glow}` }}
            />
          </div>
        </div>

        {/* ═══ RIGHT: Metrics + Status + Alert ═══════════════════ */}
        <div className="flex flex-col gap-3">

          {/* 2×3 metric cards */}
          <div className="grid grid-cols-2 gap-3">
            <MetricCard
              emoji="🌡️"
              value={fmtTemp(temp)}
              label="Temperature"
              sub={temp != null && temp > 26 ? '⚠️ Above ideal' : temp != null && temp < 18 ? '⬇️ Below ideal' : '✅ Ideal range'}
              gradFrom="from-orange-50" gradTo="to-red-50 dark:from-[#1E1510] dark:to-[#1E1510]"
              valColor="#F07848"
            />
            <MetricCard
              emoji="🔊"
              value={`${db} dB`}
              label={soundLabel.text}
              sub={
                soundEvent === 'CRYING'         ? '🚨 Crying Detected!'  :
                soundEvent === 'RESTLESS'        ? '😟 Restless'          :
                soundEvent === 'LIGHT_ACTIVITY'  ? '🌙 Light Activity'    :
                                                   '🔕 Quiet'
              }
              gradFrom="from-blue-50" gradTo="to-indigo-50 dark:from-[#10141E] dark:to-[#10141E]"
              valColor={soundEvent === 'CRYING' ? '#EF4444' : soundEvent === 'RESTLESS' ? '#F59E0B' : '#5A52E0'}
            />
            <MetricCard
              emoji="🚶"
              value={motion === 1 ? 'Active' : 'No'}
              label="Motion"
              sub={motion === 1 ? '🔴 Movement detected' : '✅ Calm'}
              gradFrom="from-green-50" gradTo="to-emerald-50 dark:from-[#0F1E16] dark:to-[#0F1E16]"
              valColor={motion === 1 ? '#EF4444' : '#3B9E72'}
            />
            <MetricCard
              emoji="💧"
              value={fmtHum(humidity)}
              label="Humidity"
              sub={humidity != null && humidity < 30 ? '🏜️ Too dry' : humidity != null && humidity > 60 ? '💦 Too humid' : '✅ Comfortable'}
              gradFrom="from-cyan-50" gradTo="to-sky-50 dark:from-[#0C1820] dark:to-[#0C1820]"
              valColor="#0EA5E9"
            />
            <MetricCard
              emoji="☀️"
              value={light ?? '—'}
              label="Light Level"
              sub={light == null ? '—' : light < 100 ? '🌑 Very dark' : light < 300 ? '🌙 Dim' : light < 600 ? '💡 Moderate' : '☀️ Bright'}
              gradFrom="from-yellow-50" gradTo="to-amber-50 dark:from-[#1E1A0A] dark:to-[#1E1A0A]"
              valColor="#F59E0B"
            />
            {/* Light bar — spans full width */}
            <div className="rounded-2xl border border-white/70 dark:border-[#2A2E4A] p-4 flex flex-col justify-center shadow-md bg-gradient-to-br from-yellow-50 to-amber-50 dark:from-[#1E1A0A] dark:to-[#1E1A0A]">
              <div className="text-[10px] text-gray-500 dark:text-gray-400 font-semibold mb-1.5">Light Range (0 – 1023)</div>
              <div className="h-3 w-full rounded-full overflow-hidden bg-gray-200 dark:bg-[#161928]">
                <div
                  className="h-full rounded-full transition-all duration-700"
                  style={{
                    width: `${Math.min(100, ((light ?? 0) / 1023) * 100)}%`,
                    background: (light ?? 0) < 100 ? '#6366F1' : (light ?? 0) < 400 ? '#F59E0B' : '#EF4444',
                  }}
                />
              </div>
              <div className="flex justify-between text-[9px] text-gray-400 mt-1">
                <span>🌑 Dark</span>
                <span>💡 Normal</span>
                <span>☀️ Bright</span>
              </div>
            </div>
          </div>

          {/* Sound state pill */}
          <div className="flex items-center gap-3 px-4 py-3.5 rounded-2xl border border-nest-border dark:border-[#2A2E4A] bg-white dark:bg-[#1E2236] shadow-sm transition-colors">
            <span className="text-2xl leading-none">{soundLabel.icon}</span>
            <div>
              <div className={`text-sm font-bold ${soundLabel.color}`}>{soundLabel.text}</div>
              <div className="text-xs text-gray-400">
                {db} dB · level {soundLevel}
                {mlConfidence !== null && (
                  <span className="ml-2 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-indigo-100 dark:bg-indigo-900/40 text-indigo-600 dark:text-indigo-300">
                    ML {mlConfidence}%
                  </span>
                )}
              </div>
            </div>
            <div className="ml-auto flex items-center gap-1.5">
              <span className={`w-2 h-2 rounded-full ${alert.dot} animate-pulse`} />
              <span className="text-xs font-semibold text-gray-500">Status</span>
            </div>
          </div>

          {/* Alert banner */}
          <div className={`flex-1 flex items-center gap-4 px-5 py-4 rounded-2xl border-2 ${alert.bg} ${alert.border} transition-all duration-500 shadow-sm`}>
            <span className="text-4xl flex-shrink-0 leading-none">{alert.icon}</span>
            <div>
              <div className={`text-sm font-extrabold leading-snug ${alert.txt}`}>{alert.text}</div>
              <div className="text-xs text-gray-400 mt-0.5">Updated just now</div>
            </div>
          </div>

        </div>
      </div>

      {/* ── Bottom: Room Conditions ──────────────────────────────── */}
      <div className="grid gap-4" style={{ gridTemplateColumns: '1fr 1fr 1fr 1fr' }}>

        {/* Temperature guide */}
        <div className="bg-white dark:bg-[#1E2236] rounded-2xl border border-nest-border dark:border-[#2A2E4A] p-4 shadow-sm">
          <div className="flex items-center gap-2 mb-3">
            <span className="text-xl">🌡️</span>
            <div>
              <div className="text-xs font-bold text-gray-700 dark:text-gray-200">Room Temperature</div>
              <div className="text-[10px] text-gray-400">Ideal: 18°C – 26°C</div>
            </div>
          </div>
          {[
            { label: 'Too Cold',  range: 'Below 18°C', color: '#0EA5E9', active: temp != null && temp < 18 },
            { label: 'Perfect ✅', range: '18°C – 26°C', color: '#3B9E72', active: temp != null && temp >= 18 && temp <= 26 },
            { label: 'Warm',      range: '26°C – 28°C', color: '#F59E0B', active: temp != null && temp > 26 && temp <= 28 },
            { label: 'Too Hot ⚠️',range: 'Above 28°C', color: '#EF4444', active: temp != null && temp > 28 },
          ].map(({ label, range, color, active }) => (
            <div key={label} className={`flex items-center justify-between px-3 py-1.5 rounded-lg mb-1.5 transition-all ${active ? 'shadow-sm' : 'opacity-40'}`}
              style={active ? { backgroundColor: color + '18', border: `1px solid ${color}55` } : { border: '1px solid transparent' }}>
              <span className="text-xs font-semibold" style={{ color: active ? color : '#94A3B8' }}>{label}</span>
              <span className="text-[10px] text-gray-400">{range}</span>
            </div>
          ))}
        </div>

        {/* Humidity guide */}
        <div className="bg-white dark:bg-[#1E2236] rounded-2xl border border-nest-border dark:border-[#2A2E4A] p-4 shadow-sm">
          <div className="flex items-center gap-2 mb-3">
            <span className="text-xl">💧</span>
            <div>
              <div className="text-xs font-bold text-gray-700 dark:text-gray-200">Humidity Level</div>
              <div className="text-[10px] text-gray-400">Ideal: 40% – 60%</div>
            </div>
          </div>
          {[
            { label: 'Too Dry',     range: 'Below 30%', color: '#F59E0B', active: humidity != null && humidity < 30 },
            { label: 'Low',         range: '30% – 40%', color: '#0EA5E9', active: humidity != null && humidity >= 30 && humidity < 40 },
            { label: 'Perfect ✅',  range: '40% – 60%', color: '#3B9E72', active: humidity != null && humidity >= 40 && humidity <= 60 },
            { label: 'Too Humid ⚠️',range: 'Above 60%', color: '#EF4444', active: humidity != null && humidity > 60 },
          ].map(({ label, range, color, active }) => (
            <div key={label} className={`flex items-center justify-between px-3 py-1.5 rounded-lg mb-1.5 transition-all ${active ? 'shadow-sm' : 'opacity-40'}`}
              style={active ? { backgroundColor: color + '18', border: `1px solid ${color}55` } : { border: '1px solid transparent' }}>
              <span className="text-xs font-semibold" style={{ color: active ? color : '#94A3B8' }}>{label}</span>
              <span className="text-[10px] text-gray-400">{range}</span>
            </div>
          ))}
        </div>

        {/* Sound guide */}
        <div className="bg-white dark:bg-[#1E2236] rounded-2xl border border-nest-border dark:border-[#2A2E4A] p-4 shadow-sm">
          <div className="flex items-center gap-2 mb-3">
            <span className="text-xl">🔊</span>
            <div>
              <div className="text-xs font-bold text-gray-700 dark:text-gray-200">Sound Level</div>
              <div className="text-[10px] text-gray-400">ML Classification · {db} dB</div>
            </div>
          </div>
          {[
            { label: 'Silent 😴',   range: 'Quiet',          color: '#3B9E72', active: soundEvent === 'QUIET' },
            { label: 'Quiet ✅',    range: 'Light Activity',  color: '#0EA5E9', active: soundEvent === 'LIGHT_ACTIVITY' },
            { label: 'Moderate 🔉', range: 'Restless',        color: '#F59E0B', active: soundEvent === 'RESTLESS' },
            { label: 'Loud ⚠️',     range: 'Crying',          color: '#EF4444', active: soundEvent === 'CRYING' },
          ].map(({ label, range, color, active }) => (
            <div key={label} className={`flex items-center justify-between px-3 py-1.5 rounded-lg mb-1.5 transition-all ${active ? 'shadow-sm' : 'opacity-40'}`}
              style={active ? { backgroundColor: color + '18', border: `1px solid ${color}55` } : { border: '1px solid transparent' }}>
              <span className="text-xs font-semibold" style={{ color: active ? color : '#94A3B8' }}>{label}</span>
              <span className="text-[10px] text-gray-400">{range}</span>
            </div>
          ))}
        </div>

        {/* Light guide */}
        <div className="bg-white dark:bg-[#1E2236] rounded-2xl border border-nest-border dark:border-[#2A2E4A] p-4 shadow-sm">
          <div className="flex items-center gap-2 mb-3">
            <span className="text-xl">☀️</span>
            <div>
              <div className="text-xs font-bold text-gray-700 dark:text-gray-200">Light Level</div>
              <div className="text-[10px] text-gray-400">Now: {light ?? '—'} / 1023</div>
            </div>
          </div>
          {[
            { label: 'Very Dark 🌑',  range: '0 – 100',    color: '#6366F1', active: (light ?? 0) < 100 },
            { label: 'Dim 🌙',        range: '100 – 300',  color: '#8B5CF6', active: (light ?? 0) >= 100 && (light ?? 0) < 300 },
            { label: 'Normal ✅',     range: '300 – 600',  color: '#3B9E72', active: (light ?? 0) >= 300 && (light ?? 0) < 600 },
            { label: 'Bright ☀️',    range: '600 – 1023', color: '#F59E0B', active: (light ?? 0) >= 600 },
          ].map(({ label, range, color, active }) => (
            <div key={label} className={`flex items-center justify-between px-3 py-1.5 rounded-lg mb-1.5 transition-all ${active ? 'shadow-sm' : 'opacity-40'}`}
              style={active ? { backgroundColor: color + '18', border: `1px solid ${color}55` } : { border: '1px solid transparent' }}>
              <span className="text-xs font-semibold" style={{ color: active ? color : '#94A3B8' }}>{label}</span>
              <span className="text-[10px] text-gray-400">{range}</span>
            </div>
          ))}
        </div>

      </div>
    </div>
  )
}
