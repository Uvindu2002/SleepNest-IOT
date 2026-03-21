import { useSensor } from '../context/SensorContext'

const SOUND_ROWS = [
  { label: '😴 Quiet',          key: 'QUIET',          bar: 'bg-accent'     },
  { label: '🌙 Light Activity', key: 'LIGHT_ACTIVITY',  bar: 'bg-teal-400'  },
  { label: '😟 Restless',       key: 'RESTLESS',        bar: 'bg-yellow-400'},
  { label: '😭 Crying',         key: 'CRYING',          bar: 'bg-red-400'   },
]

export default function Sleep() {
  const { comfort, soundDist, readings, motionCount, temp, humidity } = useSensor()
  const total    = Object.values(soundDist).reduce((a, b) => a + b, 0) || 1
  const quietPct = Math.round((soundDist.QUIET / total) * 100)

  const quality =
    quietPct >= 80 ? { label: '😴 Deep Sleep',  color: 'text-accent'        } :
    quietPct >= 60 ? { label: '🌙 Light Sleep',  color: 'text-teal-500'      } :
    quietPct >= 40 ? { label: '😟 Restless',     color: 'text-yellow-500'    } :
                     { label: '😭 Disrupted',    color: 'text-red-500'       }

  return (
    <div className="flex flex-col gap-3">

      {/* Title */}
      <div className="text-base font-bold text-gray-800 dark:text-gray-100 flex-shrink-0">💤 Sleep Analysis</div>

      {/* 2-column layout */}
      <div className="grid gap-3" style={{ gridTemplateColumns: '1fr 1fr' }}>

        {/* ── LEFT: session quality + quiet-time bar ──────────── */}
        <div className="flex flex-col gap-3">

          {/* Quality card */}
          <div className="bg-white dark:bg-[#1E2236] rounded-2xl border border-nest-border dark:border-[#2A2E4A] p-5 shadow-sm transition-colors flex flex-col justify-between">
            <div className="flex items-center justify-between mb-4">
              <div>
                <div className="text-[10px] uppercase tracking-widest text-gray-400 font-semibold mb-1">Session Quality</div>
                <div className={`text-xl font-extrabold ${quality.color}`}>{quality.label}</div>
              </div>
              <div className="text-5xl leading-none">🌙</div>
            </div>

            {/* Quiet-time bar */}
            <div className="mb-4">
              <div className="flex justify-between text-[10px] text-gray-400 mb-1.5">
                <span>Quiet time</span>
                <span className="font-semibold text-accent">{quietPct}%</span>
              </div>
              <div className="h-3 rounded-full bg-nest-bg dark:bg-[#161928] overflow-hidden">
                <div className="h-full rounded-full bg-accent transition-all duration-700" style={{ width: `${quietPct}%` }} />
              </div>
              <div className="text-[10px] text-gray-400 mt-1.5">
                Based on {readings} sensor readings this session
              </div>
            </div>

            {/* 3 live stats */}
            <div className="grid grid-cols-3 gap-2">
              <div className="bg-nest-green dark:bg-[#17302A] rounded-xl p-3 text-center">
                <div className="text-xl font-extrabold text-accent">{comfort}%</div>
                <div className="text-[10px] text-gray-400 mt-0.5">Comfort</div>
              </div>
              <div className="bg-nest-blue dark:bg-[#1A1E3A] rounded-xl p-3 text-center">
                <div className="text-xl font-extrabold text-[#5A52E0]">{motionCount}</div>
                <div className="text-[10px] text-gray-400 mt-0.5">Movements</div>
              </div>
              <div className="bg-nest-bg dark:bg-[#161928] rounded-xl p-3 text-center">
                <div className="text-xl font-extrabold text-gray-700 dark:text-gray-200">
                  {temp != null ? `${temp.toFixed(0)}°` : '—'}
                </div>
                <div className="text-[10px] text-gray-400 mt-0.5">Temp</div>
              </div>
            </div>
          </div>

        </div>

        {/* ── RIGHT: sound breakdown + info note ──────────────── */}
        <div className="flex flex-col gap-3">

          {/* Sound breakdown */}
          <div className="bg-white dark:bg-[#1E2236] rounded-2xl border border-nest-border dark:border-[#2A2E4A] p-5 shadow-sm transition-colors">
            <div className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-4">
              Session Sound Breakdown
            </div>
            <div className="flex flex-col gap-3.5">
              {SOUND_ROWS.map(({ label, key, bar }) => {
                const pct   = Math.round((soundDist[key] / total) * 100)
                const count = soundDist[key] || 0
                return (
                  <div key={key} className="flex items-center gap-3">
                    <span className="text-xs text-gray-600 dark:text-gray-300 w-36 flex-shrink-0">{label}</span>
                    <div className="flex-1 h-2 bg-nest-bg dark:bg-[#161928] rounded-full overflow-hidden">
                      <div className={`${bar} h-full rounded-full transition-all duration-500`} style={{ width: `${pct}%` }} />
                    </div>
                    <span className="text-[11px] font-semibold text-gray-500 w-9 text-right">{pct}%</span>
                    <span className="text-[10px] text-gray-400 w-10 text-right">{count}×</span>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Info note */}
          <div className="bg-nest-cream dark:bg-[#1A1D2E] border border-dashed border-nest-border dark:border-[#2A2E4A] rounded-2xl p-4 text-center flex-shrink-0">
            <div className="text-2xl mb-2">📊</div>
            <div className="text-xs font-semibold text-gray-600 dark:text-gray-300 mb-1">More data needed for overnight analysis</div>
            <div className="text-[11px] text-gray-400 leading-relaxed">
              Keep the monitor running while baby sleeps to collect overnight patterns.
            </div>
          </div>

        </div>
      </div>
    </div>
  )
}
