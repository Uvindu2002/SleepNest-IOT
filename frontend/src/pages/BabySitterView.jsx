import { useSensor } from '../context/SensorContext'
import { comfortEmoji } from '../utils/comfort'
import { fmtTemp, fmtHum } from '../utils/format'

function getTheme(comfort, soundEvent, motion) {
  if (soundEvent === 'CRYING')
    return { grad: 'from-red-50 via-rose-50 to-pink-50 dark:from-[#250808] dark:via-[#2A0A0A] dark:to-[#220810]', ring: '#EF4444', badge: 'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400', border: 'border-red-200 dark:border-red-800/40', label: 'Needs Attention!' }
  if (soundEvent === 'RESTLESS' || motion === 1)
    return { grad: 'from-amber-50 via-yellow-50 to-orange-50 dark:from-[#271A06] dark:via-[#2E2008] dark:to-[#271608]', ring: '#F59E0B', badge: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400', border: 'border-amber-200 dark:border-amber-700/40', label: 'May Need Attention' }
  if (comfort >= 70)
    return { grad: 'from-emerald-50 via-green-50 to-teal-50 dark:from-[#0D2419] dark:via-[#112B1E] dark:to-[#0F2A1A]', ring: '#3B9E72', badge: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300', border: 'border-emerald-200 dark:border-emerald-800/40', label: 'Resting Well' }
  return { grad: 'from-blue-50 via-indigo-50 to-violet-50 dark:from-[#0C1228] dark:via-[#0F1630] dark:to-[#0D1228]', ring: '#5A52E0', badge: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300', border: 'border-indigo-200 dark:border-indigo-800/40', label: 'Monitoring' }
}

const ALERT_CFG = {
  CRYING:   { icon: '😭', text: 'Baby is crying! Please check immediately.',           bg: 'bg-red-50 dark:bg-red-900/20',     border: 'border-red-200 dark:border-red-800',     txt: 'text-red-700 dark:text-red-300'    },
  RESTLESS: { icon: '😟', text: 'Baby seems restless. May need attention.',             bg: 'bg-amber-50 dark:bg-amber-900/20', border: 'border-amber-200 dark:border-amber-800', txt: 'text-amber-700 dark:text-amber-300'},
  MOTION:   { icon: '🔴', text: 'Movement detected. Baby may be waking up.',            bg: 'bg-orange-50 dark:bg-orange-900/20',border:'border-orange-200 dark:border-orange-800',txt: 'text-orange-700 dark:text-orange-300'},
  LOW:      { icon: '⚠️', text: 'Comfort score is low. Check the room conditions.',    bg: 'bg-yellow-50 dark:bg-yellow-900/20',border:'border-yellow-200 dark:border-yellow-800',txt: 'text-yellow-700 dark:text-yellow-300'},
  OK:       { icon: '✅', text: 'All conditions are optimal. Baby is resting comfortably.', bg: 'bg-green-50 dark:bg-green-900/20', border: 'border-green-200 dark:border-green-800', txt: 'text-green-700 dark:text-green-300' },
}

function getAlert(soundEvent, motion, comfort) {
  if (soundEvent === 'CRYING')   return ALERT_CFG.CRYING
  if (soundEvent === 'RESTLESS') return ALERT_CFG.RESTLESS
  if (motion === 1)              return ALERT_CFG.MOTION
  if (comfort < 50)              return ALERT_CFG.LOW
  return ALERT_CFG.OK
}

export default function BabySitterView() {
  const { comfort, statusMsg, temp, humidity, soundLevel, soundEvent, soundLabel, motion, db } = useSensor()
  const theme = getTheme(comfort, soundEvent, motion)
  const alert = getAlert(soundEvent, motion, comfort)
  const emoji = comfortEmoji(comfort)

  return (
    <div className="flex flex-col gap-3">

      {/* ── Page title ─────────────────────────────────────────── */}
      <div className="flex items-center gap-2 flex-shrink-0">
        <span className="text-base font-bold text-gray-800 dark:text-gray-100">👁️ Baby Sitter View</span>
        <div className="ml-auto flex items-center gap-1.5 text-[11px] font-semibold text-gray-400">
          <span className="w-2 h-2 rounded-full bg-accent live-dot inline-block" />
          Live
        </div>
      </div>

      {/* ── Main content: 2 columns ─────────────────────────────── */}
      <div className="grid gap-3" style={{ gridTemplateColumns: '1fr 1fr' }}>

        {/* ── LEFT: big comfort display ─────────────────────────── */}
        <div
          className={`relative overflow-hidden rounded-3xl border flex flex-col items-center justify-center p-6 text-center bg-gradient-to-br ${theme.grad} ${theme.border} transition-all duration-700`}
        >
          {/* Decorative blob */}
          <div className="pointer-events-none absolute -top-10 -right-10 w-48 h-48 rounded-full opacity-20 blur-3xl" style={{ background: theme.ring }} />

          {/* Status badge */}
          <span className={`text-xs font-bold px-3 py-1 rounded-full mb-4 ${theme.badge}`}>
            {theme.label}
          </span>

          {/* Big emoji */}
          <div
            className="text-[96px] leading-none mb-3 select-none"
            style={comfort < 40 ? { filter: `drop-shadow(0 0 14px ${theme.ring}99)`, animation: 'pulse-dot 1.4s infinite' } : undefined}
          >
            {emoji}
          </div>

          {/* Status message */}
          <div className="text-lg font-bold text-gray-800 dark:text-gray-100 mb-3 leading-tight">{statusMsg}</div>

          {/* Score */}
          <div className="text-7xl font-extrabold leading-none mb-1" style={{ color: theme.ring }}>
            {comfort}
          </div>
          <div className="text-sm text-gray-400 font-medium mb-4">Comfort Score / 100</div>

          {/* Bar */}
          <div className="w-full max-w-[200px] h-2.5 rounded-full bg-black/[0.07] dark:bg-white/10 overflow-hidden">
            <div className="h-full rounded-full transition-all duration-700" style={{ width: `${comfort}%`, background: theme.ring }} />
          </div>
        </div>

        {/* ── RIGHT: metrics + status + alert ─────────────────────── */}
        <div className="flex flex-col gap-3">

          {/* 4 metric cards */}
          <div className="grid grid-cols-2 gap-3 flex-shrink-0">
            {[
              { icon: '🌡️', val: fmtTemp(temp),                     lbl: 'Temperature' },
              { icon: '🔊', val: `${db} dB`,                         lbl: soundLabel.text },
              { icon: '🚶', val: motion === 1 ? '🔴 Yes' : '⚪ No', lbl: 'Motion'      },
              { icon: '💧', val: fmtHum(humidity),                   lbl: 'Humidity'    },
            ].map(({ icon, val, lbl }) => (
              <div key={lbl} className="bg-white dark:bg-[#1E2236] rounded-2xl border border-nest-border dark:border-[#2A2E4A] p-4 flex flex-col items-center justify-center text-center shadow-sm transition-colors">
                <div className="text-2xl mb-1 leading-none">{icon}</div>
                <div className="text-base font-bold text-gray-800 dark:text-gray-100 leading-tight">{val}</div>
                <div className="text-[10px] text-gray-400 mt-0.5">{lbl}</div>
              </div>
            ))}
          </div>

          {/* Sound state */}
          <div className={`flex-shrink-0 flex items-center gap-2.5 px-4 py-3 rounded-xl border border-nest-border dark:border-[#2A2E4A] bg-white dark:bg-[#1E2236] text-sm font-semibold ${soundLabel.color} transition-colors`}>
            <span className="text-lg leading-none">{soundLabel.icon}</span>
            <span>{soundLabel.text}</span>
            <span className="ml-auto text-[11px] font-normal text-gray-400">{db} dB · level {soundLevel}</span>
          </div>

          {/* Alert banner — fills remaining height */}
          <div className={`flex-1 min-h-0 flex items-center gap-3 px-4 rounded-2xl border ${alert.bg} ${alert.border} transition-colors`}>
            <span className="text-4xl flex-shrink-0 leading-none">{alert.icon}</span>
            <span className={`text-sm font-semibold leading-snug ${alert.txt}`}>{alert.text}</span>
          </div>

        </div>
      </div>
    </div>
  )
}
