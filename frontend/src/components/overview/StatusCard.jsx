import { useSensor } from '../../context/SensorContext'
import { comfortEmoji } from '../../utils/comfort'

// ── Dynamic colour theme keyed on comfort score ──────────────────
function getTheme(score) {
  if (score >= 85) return {
    grad:   'from-emerald-50  via-green-50   to-teal-50   dark:from-[#0D2419] dark:via-[#112B1E] dark:to-[#0F2A1A]',
    ring:   '#3B9E72',
    track:  'rgba(59,158,114,0.18)',
    badge:  'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300',
    border: 'border-emerald-200 dark:border-emerald-800/40',
    label:  'text-emerald-700 dark:text-emerald-400',
    dot:    'bg-emerald-400',
    glow:   '0 0 24px rgba(59,158,114,0.22)',
    tag:    'Optimal',
  }
  if (score >= 70) return {
    grad:   'from-teal-50  via-cyan-50   to-sky-50   dark:from-[#092228] dark:via-[#0C2830] dark:to-[#0A1E28]',
    ring:   '#0D9488',
    track:  'rgba(13,148,136,0.18)',
    badge:  'bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-300',
    border: 'border-teal-200 dark:border-teal-800/40',
    label:  'text-teal-700 dark:text-teal-400',
    dot:    'bg-teal-400',
    glow:   '0 0 24px rgba(13,148,136,0.22)',
    tag:    'Good',
  }
  if (score >= 55) return {
    grad:   'from-blue-50  via-indigo-50 to-violet-50 dark:from-[#0C1228] dark:via-[#0F1630] dark:to-[#0D1228]',
    ring:   '#5A52E0',
    track:  'rgba(90,82,224,0.18)',
    badge:  'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300',
    border: 'border-indigo-200 dark:border-indigo-800/40',
    label:  'text-indigo-700 dark:text-indigo-400',
    dot:    'bg-indigo-400',
    glow:   '0 0 24px rgba(90,82,224,0.22)',
    tag:    'Fair',
  }
  if (score >= 40) return {
    grad:   'from-amber-50  via-yellow-50 to-orange-50 dark:from-[#271A06] dark:via-[#2E2008] dark:to-[#271608]',
    ring:   '#F59E0B',
    track:  'rgba(245,158,11,0.18)',
    badge:  'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',
    border: 'border-amber-200 dark:border-amber-700/40',
    label:  'text-amber-700 dark:text-amber-400',
    dot:    'bg-amber-400',
    glow:   '0 0 24px rgba(245,158,11,0.22)',
    tag:    'Restless',
  }
  return {
    grad:   'from-red-50   via-rose-50   to-pink-50   dark:from-[#250808] dark:via-[#2A0A0A] dark:to-[#220810]',
    ring:   '#EF4444',
    track:  'rgba(239,68,68,0.18)',
    badge:  'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300',
    border: 'border-red-200 dark:border-red-700/40',
    label:  'text-red-600 dark:text-red-400',
    dot:    'bg-red-400',
    glow:   '0 0 28px rgba(239,68,68,0.28)',
    tag:    'Alert',
  }
}

// ── SVG arc ring ────────────────────────────────────────────────
const RADIUS = 42
const STROKE = 7
const CIRC   = 2 * Math.PI * RADIUS   // ≈ 263.9

function ScoreRing({ pct, ring, track, glow }) {
  const offset = CIRC * (1 - pct / 100)
  const size   = (RADIUS + STROKE) * 2

  return (
    <svg
      width={size} height={size}
      style={{ filter: `drop-shadow(${glow})` }}
      className="transition-all duration-700"
    >
      {/* Track */}
      <circle
        cx={size / 2} cy={size / 2} r={RADIUS}
        fill="none" stroke={track} strokeWidth={STROKE}
      />
      {/* Arc */}
      <circle
        cx={size / 2} cy={size / 2} r={RADIUS}
        fill="none"
        stroke={ring}
        strokeWidth={STROKE}
        strokeLinecap="round"
        strokeDasharray={CIRC}
        strokeDashoffset={offset}
        style={{
          transform: 'rotate(-90deg)',
          transformOrigin: '50% 50%',
          transition: 'stroke-dashoffset 0.9s cubic-bezier(0.4,0,0.2,1)',
        }}
      />
    </svg>
  )
}

// ── Mini stat pill ───────────────────────────────────────────────
function StatPill({ icon, value, label }) {
  return (
    <div className="flex flex-col items-center gap-0.5">
      <span className="text-base leading-none">{icon}</span>
      <span className="text-[11px] font-bold text-gray-700 dark:text-gray-200 leading-none">{value}</span>
      <span className="text-[9px] text-gray-400 leading-none">{label}</span>
    </div>
  )
}

// ── Main card ────────────────────────────────────────────────────
export default function StatusCard({ style }) {
  const { comfort, statusMsg, temp, humidity, db } = useSensor()
  const theme  = getTheme(comfort)
  const emoji  = comfortEmoji(comfort)
  const size   = (RADIUS + STROKE) * 2   // matches SVG size

  return (
    <div
      style={style}
      className={`
        relative overflow-hidden rounded-2xl border p-4 flex flex-col
        bg-gradient-to-br ${theme.grad} ${theme.border}
        transition-all duration-700
      `}
    >
      {/* ── Decorative blurred blob ─────────────────────────────── */}
      <div
        className="pointer-events-none absolute -top-6 -right-6 w-28 h-28 rounded-full opacity-25 blur-2xl"
        style={{ background: theme.ring }}
      />

      {/* ── Header row ──────────────────────────────────────────── */}
      <div className="flex items-center justify-between mb-3">
        <div>
          <div className="text-[9px] uppercase tracking-[0.18em] text-gray-400 font-semibold mb-0.5">
            Comfort Status
          </div>
          <div className="text-sm font-extrabold text-gray-800 dark:text-gray-100 leading-tight">
            {statusMsg}
          </div>
        </div>

        {/* Status tag */}
        <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full ${theme.badge}`}>
          {theme.tag}
        </span>
      </div>

      {/* ── Score ring + emoji ───────────────────────────────────── */}
      <div className="flex items-center justify-between gap-3">

        {/* Left: large animated emoji */}
        <div className="flex flex-col items-center gap-1">
          <div
            className="relative flex items-center justify-center"
            style={{ width: size, height: size }}
          >
            {/* SVG ring underneath */}
            <ScoreRing
              pct={comfort}
              ring={theme.ring}
              track={theme.track}
              glow={theme.glow}
            />

            {/* Emoji centred over the SVG */}
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-0.5">
              <span
                className="text-2xl leading-none select-none"
                style={{
                  filter: comfort < 40 ? `drop-shadow(0 0 6px ${theme.ring}88)` : 'none',
                  animation: comfort < 40 ? 'pulse-dot 1.4s infinite' : 'none',
                }}
              >
                {emoji}
              </span>
              <span
                className="text-[11px] font-extrabold leading-none"
                style={{ color: theme.ring }}
              >
                {comfort}%
              </span>
            </div>
          </div>

          <span className="text-[9px] text-gray-400 font-medium">Comfort Score</span>
        </div>

        {/* Right: mini stat pills */}
        <div className="flex-1 flex flex-col gap-2.5">
          {/* Comfort bar */}
          <div>
            <div className="flex justify-between text-[9px] text-gray-400 mb-1">
              <span>Score</span>
              <span style={{ color: theme.ring }} className="font-semibold">{comfort}/100</span>
            </div>
            <div className="h-1.5 rounded-full bg-black/[0.07] dark:bg-white/10 overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-700"
                style={{ width: `${comfort}%`, background: theme.ring }}
              />
            </div>
          </div>

          {/* 3 mini stats */}
          <div className="flex justify-around pt-1 border-t border-black/[0.06] dark:border-white/[0.06]">
            <StatPill
              icon="🌡️"
              value={temp != null ? `${temp.toFixed(1)}°` : '—'}
              label="Temp"
            />
            <StatPill
              icon="💧"
              value={humidity != null ? `${Math.round(humidity)}%` : '—'}
              label="Humid"
            />
            <StatPill
              icon="🔊"
              value={db != null ? `${db}dB` : '—'}
              label="Sound"
            />
          </div>
        </div>
      </div>

      {/* ── Live dot ────────────────────────────────────────────── */}
      <div className="flex items-center gap-1.5 mt-3 pt-2.5 border-t border-black/[0.06] dark:border-white/[0.06]">
        <span className={`w-1.5 h-1.5 rounded-full live-dot ${theme.dot}`} />
        <span className="text-[10px] font-medium" style={{ color: theme.ring }}>
          Live monitoring
        </span>
      </div>
    </div>
  )
}
