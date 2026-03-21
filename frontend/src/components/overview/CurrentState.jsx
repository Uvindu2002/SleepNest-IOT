import { useSensor } from '../../context/SensorContext'
import { fmtTemp } from '../../utils/format'

function fmtDuration(ms) {
  if (ms < 1000) return `${ms}ms`
  const s = Math.floor(ms / 1000)
  if (s < 60) return `${s}s`
  return `${Math.floor(s / 60)}m ${s % 60}s`
}

export default function CurrentState({ style }) {
  const {
    temp, db, soundEvent, soundLabel,
    motion, motionDurationMs, motionThreshold, motionExceeded, motionPenalty,
  } = useSensor()

  const alertTags = buildTags(temp, soundEvent, motionExceeded)

  return (
    <div
      style={style}
      className="bg-white dark:bg-[#1E2236] rounded-2xl border border-nest-border dark:border-[#2A2E4A] p-4 flex flex-col gap-3 shadow-sm transition-colors"
    >
      {/* Header */}
      <div className="flex items-center justify-between">
        <span className="text-sm font-bold text-gray-800 dark:text-gray-100">Current State</span>
        <div className="flex items-center gap-1.5 text-[11px] font-semibold text-gray-500 dark:text-gray-400">
          <span className="w-2 h-2 rounded-full bg-accent live-dot inline-block" />
          Live
        </div>
      </div>

      {/* Temp + dB boxes */}
      <div className="grid grid-cols-2 gap-2">
        <div className="relative overflow-hidden bg-white dark:bg-[#1E2236] border border-nest-border dark:border-[#2A2E4A] rounded-xl p-3">
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-nest-green/70 to-transparent dark:from-[#17302A]/70 rounded-xl" />
          <div className="relative">
            <div className="text-[9px] font-semibold text-gray-400 uppercase tracking-wider mb-1.5 flex items-center gap-1">
              🌡️ Temp
            </div>
            <div className="text-xl font-extrabold text-gray-800 dark:text-gray-100 leading-none">{fmtTemp(temp)}</div>
            <div className="text-[9px] text-gray-400 mt-1">
              {temp != null && temp > 24 ? '⚠️ Above ideal' : temp != null && temp < 18 ? '⬇️ Below ideal' : '✅ Good range'}
            </div>
          </div>
        </div>
        <div className="relative overflow-hidden bg-white dark:bg-[#1E2236] border border-nest-border dark:border-[#2A2E4A] rounded-xl p-3">
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-nest-blue/70 to-transparent dark:from-[#1A1E3A]/70 rounded-xl" />
          <div className="relative">
            <div className="text-[9px] font-semibold text-gray-400 uppercase tracking-wider mb-1.5 flex items-center gap-1">
              🔊 Sound
            </div>
            <div className="text-xl font-extrabold text-gray-800 dark:text-gray-100 leading-none">{db} dB</div>
            <div className="text-[9px] text-gray-400 mt-1">
              {db < 40 ? '🔕 Very quiet' : db < 60 ? '🔉 Moderate' : '🔊 Loud'}
            </div>
          </div>
        </div>
      </div>

      {/* Sound state */}
      <div className={`flex items-center gap-2 text-sm font-semibold pb-2.5 border-b border-nest-border dark:border-[#2A2E4A] ${soundLabel.color}`}>
        <span>{soundLabel.icon}</span>
        <span>{soundLabel.text}</span>
      </div>

      {/* Motion duration row */}
      {motion === 1 && (
        <div className="flex items-center justify-between text-[11px]">
          <span className="flex items-center gap-1.5 text-orange-500 font-semibold">
            <span className="w-1.5 h-1.5 rounded-full bg-orange-500 animate-pulse inline-block" />
            Motion active
          </span>
          <span className={`font-bold ${motionExceeded ? 'text-red-500' : 'text-orange-400'}`}>
            {fmtDuration(motionDurationMs)}
            {' '}/ {Math.round(motionThreshold / 1000)}s threshold
          </span>
        </div>
      )}

      {/* Sustained motion warning */}
      {motionExceeded && (
        <div className="flex items-center gap-2 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-900 rounded-xl px-3 py-2">
          <span className="text-base">⚠️</span>
          <div>
            <div className="text-[11px] font-bold text-red-600 dark:text-red-400">Sustained Motion!</div>
            <div className="text-[10px] text-red-500 dark:text-red-500">
              Comfort –{motionPenalty} pts · Baby may need attention
            </div>
          </div>
        </div>
      )}

      {/* Live alerts */}
      <div className="flex items-center justify-between">
        <span className="text-[10px] text-gray-400 uppercase tracking-wider">Live Alerts</span>
        <span className="text-sm font-semibold text-gray-700 dark:text-gray-200">
          {alertTags.length === 0 ? 'None' : `${alertTags.length} active`}
        </span>
      </div>

      {/* Tags */}
      <div className="flex flex-wrap gap-1.5">
        {alertTags.length === 0 ? (
          <span className="text-[11px] bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 px-2.5 py-0.5 rounded-full font-semibold">
            All OK
          </span>
        ) : (
          alertTags.map((t, i) => (
            <span
              key={i}
              className={`text-[11px] px-2.5 py-0.5 rounded-full font-semibold ${t.cls}`}
            >
              {t.label}
            </span>
          ))
        )}
      </div>
    </div>
  )
}

function buildTags(temp, soundEvent, motionExceeded) {
  const tags = []
  if (soundEvent === 'CRYING' || soundEvent === 'RESTLESS')
    tags.push({ label: 'High Noise', cls: 'bg-red-100 text-red-600' })
  if (temp != null && temp > 24)
    tags.push({ label: 'Temp High', cls: 'bg-red-100 text-red-600' })
  if (temp != null && temp < 18)
    tags.push({ label: 'Temp Low', cls: 'bg-blue-100 text-blue-600' })
  if (motionExceeded)
    tags.push({ label: 'Motion Alert', cls: 'bg-orange-100 text-orange-600' })
  return tags
}
