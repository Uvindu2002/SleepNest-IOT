import { useMemo } from 'react'
import { useSensor } from '../context/SensorContext'

const CLASS_CFG = {
  QUIET: {
    label: '😴 Quiet', isAnomaly: false,
    color: 'text-accent', bg: 'dark:bg-[#17302A]', border: 'border-accent/40',
  },
  LIGHT_ACTIVITY: {
    label: '🌙 Light Activity', isAnomaly: false,
    color: 'text-[#5A52E0]', bg: 'dark:bg-[#1A1E3A]', border: 'border-[#5A52E0]/40',
  },
  RESTLESS: {
    label: '😟 Restless', isAnomaly: true,
    color: 'text-yellow-500', bg: 'dark:bg-[#1E1A0A]', border: 'border-yellow-400/40',
  },
  CRYING: {
    label: '😭 Crying', isAnomaly: true,
    color: 'text-red-500', bg: 'dark:bg-[#2A1111]', border: 'border-red-400/40',
  },
}

const CLASS_ROWS = [
  { key: 'QUIET',          label: 'Quiet',          anomaly: false, color: '#3B9E72' },
  { key: 'LIGHT_ACTIVITY', label: 'Light Activity',  anomaly: false, color: '#5A52E0' },
  { key: 'RESTLESS',       label: 'Restless',        anomaly: true,  color: '#F59E0B' },
  { key: 'CRYING',         label: 'Crying',          anomaly: true,  color: '#EF4444' },
]

export default function AnalyseAnomaly() {
  const {
    soundEvent, soundLevel, mlConfidence, mlSource,
    localHistory, alertLog, soundDist,
  } = useSensor()

  const cfg = CLASS_CFG[soundEvent] || CLASS_CFG.QUIET

  // Normalised anomaly score 0-100 (sound level relative to max)
  const anomalyScore = Math.min(100, Math.round((soundLevel / 1023) * 100))
  const scoreColor = anomalyScore > 60 ? '#EF4444' : anomalyScore > 30 ? '#F59E0B' : '#3B9E72'

  // Session stats
  const history  = useMemo(() => localHistory.slice().reverse(), [localHistory])
  const total    = history.length || 1
  const anomCount = history.filter(h => h.soundEvt === 'CRYING' || h.soundEvt === 'RESTLESS').length
  const anomRate  = Math.round((anomCount / total) * 100)
  const rateColor = anomRate > 30 ? 'text-red-500' : anomRate > 15 ? 'text-yellow-500' : 'text-accent'

  // Class-level rate for session
  const distTotal = Object.values(soundDist).reduce((a, b) => a + b, 0) || 1

  const recentAlerts = alertLog.slice(0, 10)

  return (
    <div className="flex flex-col gap-4">

      {/* Header */}
      <div className="flex items-center gap-3">
        <span className="text-2xl">🚨</span>
        <div>
          <div className="text-base font-bold text-gray-800 dark:text-gray-100">Anomaly Detection</div>
          <div className="text-xs text-gray-400 mt-0.5">
            Random Forest (92.8% accuracy) · live classification · updates every 2 s
          </div>
        </div>
      </div>

      {/* Current state card */}
      <div className={`rounded-2xl border ${cfg.bg} ${cfg.border} bg-white p-5 shadow-sm`}>
        <div className="flex items-start justify-between mb-4">
          <div>
            <div className="text-[10px] uppercase tracking-widest text-gray-400 mb-1">Current ML Classification</div>
            <div className={`text-2xl font-extrabold ${cfg.color}`}>{cfg.label}</div>
            <div className={`text-sm font-bold mt-1 ${cfg.isAnomaly ? 'text-red-500' : 'text-green-500'}`}>
              {cfg.isAnomaly ? '⚠ ANOMALY DETECTED' : '✓ Normal behaviour'}
            </div>
          </div>
          <div className="text-right">
            <div className="text-[10px] uppercase tracking-widest text-gray-400 mb-1">Sound Level</div>
            <div className="text-4xl font-extrabold text-gray-700 dark:text-gray-100">{soundLevel}</div>
          </div>
        </div>

        {/* Anomaly score gauge */}
        <div>
          <div className="flex justify-between text-[10px] text-gray-400 mb-1.5">
            <span>Anomaly Score (normalised sound)</span>
            <span className="font-bold" style={{ color: scoreColor }}>{anomalyScore}%</span>
          </div>
          <div className="h-3 rounded-full bg-gray-100 dark:bg-[#161928] overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-700"
              style={{ width: `${anomalyScore}%`, backgroundColor: scoreColor }}
            />
          </div>
          <div className="flex justify-between text-[9px] text-gray-400 mt-1">
            <span>0 — Silent</span>
            <span>50 — Moderate</span>
            <span>100 — Maximum</span>
          </div>
        </div>

        {/* ML confidence row */}
        {mlConfidence != null && (
          <div className="mt-4 pt-3 border-t border-gray-200 dark:border-[#2A2E4A] flex gap-6">
            <div>
              <div className="text-[10px] text-gray-400 mb-0.5">ML Confidence</div>
              <div className="text-base font-extrabold text-gray-700 dark:text-gray-200">
                {(mlConfidence * 100).toFixed(1)}%
              </div>
            </div>
            <div>
              <div className="text-[10px] text-gray-400 mb-0.5">Source</div>
              <div className="text-base font-extrabold text-gray-700 dark:text-gray-200 capitalize">
                {mlSource}
              </div>
            </div>
            <div>
              <div className="text-[10px] text-gray-400 mb-0.5">Model</div>
              <div className="text-base font-extrabold text-gray-700 dark:text-gray-200">
                Random Forest
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Session summary stats */}
      <div className="grid grid-cols-4 gap-3">
        {[
          { label: 'Total Readings', val: total,             color: 'text-[#5A52E0]' },
          { label: 'Anomalies',      val: anomCount,          color: 'text-red-500'   },
          { label: 'Anomaly Rate',   val: `${anomRate}%`,    color: rateColor         },
          { label: 'Normal',         val: total - anomCount,  color: 'text-accent'    },
        ].map(({ label, val, color }) => (
          <div key={label} className="bg-white dark:bg-[#1E2236] rounded-2xl border border-nest-border dark:border-[#2A2E4A] p-4 shadow-sm text-center">
            <div className="text-[10px] uppercase tracking-widest text-gray-400 mb-1">{label}</div>
            <div className={`text-2xl font-extrabold ${color}`}>{val}</div>
          </div>
        ))}
      </div>

      {/* Class-wise anomaly breakdown */}
      <div className="bg-white dark:bg-[#1E2236] rounded-2xl border border-nest-border dark:border-[#2A2E4A] p-5 shadow-sm">
        <div className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-4">
          Class-wise Event Count (this session)
        </div>
        <div className="grid grid-cols-4 gap-3">
          {CLASS_ROWS.map(({ key, label, anomaly, color }) => {
            const count = soundDist[key] || 0
            const pct   = Math.round((count / distTotal) * 100)
            return (
              <div key={key} className="bg-nest-bg dark:bg-[#161928] rounded-xl p-3 text-center">
                <div className="text-[10px] text-gray-400 mb-1">{label}</div>
                <div className="text-2xl font-extrabold" style={{ color }}>{count}</div>
                <div className="text-[10px] text-gray-400">{pct}%</div>
                <div className={`text-[10px] font-bold mt-1 ${anomaly ? 'text-red-400' : 'text-green-500'}`}>
                  {anomaly ? '⚠ Anomaly' : '✓ Normal'}
                </div>
              </div>
            )
          })}
        </div>

        {/* Stacked bar */}
        <div className="mt-4">
          <div className="text-[10px] text-gray-400 mb-1.5">Event distribution</div>
          <div className="h-4 rounded-full overflow-hidden flex">
            {CLASS_ROWS.map(({ key, color }) => {
              const pct = Math.round(((soundDist[key] || 0) / distTotal) * 100)
              return pct > 0 ? (
                <div key={key} style={{ width: `${pct}%`, backgroundColor: color }} title={`${key}: ${pct}%`} />
              ) : null
            })}
          </div>
          <div className="flex gap-4 mt-1.5 flex-wrap">
            {CLASS_ROWS.map(({ key, label, color }) => (
              <div key={key} className="flex items-center gap-1">
                <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: color }} />
                <span className="text-[9px] text-gray-400">{label}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Recent anomaly events log */}
      <div className="bg-white dark:bg-[#1E2236] rounded-2xl border border-nest-border dark:border-[#2A2E4A] p-5 shadow-sm">
        <div className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-4">
          Recent Anomaly Events
        </div>
        {recentAlerts.length === 0 ? (
          <div className="text-center py-6 text-sm text-green-500 font-medium">
            ✓ No anomalies detected this session
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {recentAlerts.map(alert => (
              <div key={alert.id}
                className="flex items-center gap-3 text-xs px-3 py-2 rounded-xl bg-nest-bg dark:bg-[#161928]"
              >
                <span className={`font-bold w-24 flex-shrink-0 ${alert.event === 'CRYING' ? 'text-red-500' : 'text-yellow-500'}`}>
                  {alert.event === 'CRYING' ? '😭 CRYING' : '😟 RESTLESS'}
                </span>
                <span className="text-gray-500 flex-1">
                  Level: {alert.level} · {alert.db} dB
                </span>
                <span className="text-gray-400 flex-shrink-0">
                  {new Date(alert.ts).toLocaleTimeString()}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Info banner */}
      <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/40 rounded-2xl px-5 py-3 text-xs text-red-700 dark:text-red-300 leading-relaxed">
        <span className="font-bold">Method:</span> A Random Forest model (10,000-sample synthetic dataset,
        92.8% accuracy, F1&nbsp;=&nbsp;0.928) classifies every reading into
        QUIET / LIGHT_ACTIVITY / RESTLESS / CRYING.
        RESTLESS and CRYING are treated as anomalies.
        The anomaly score is the normalised sound level (0–100 %).
      </div>

    </div>
  )
}
