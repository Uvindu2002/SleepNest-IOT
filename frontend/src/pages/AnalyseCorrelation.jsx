import { useRef, useEffect, useMemo } from 'react'
import { useSensor } from '../context/SensorContext'
import {
  Chart, ScatterController, PointElement,
  LinearScale, Tooltip, Legend,
} from 'chart.js'

Chart.register(ScatterController, PointElement, LinearScale, Tooltip, Legend)

// ── Pearson r ─────────────────────────────────────────────────────
function pearsonR(xs, ys) {
  const n = xs.length
  if (n < 3) return 0
  const mx = xs.reduce((a, b) => a + b, 0) / n
  const my = ys.reduce((a, b) => a + b, 0) / n
  const num  = xs.reduce((a, x, i) => a + (x - mx) * (ys[i] - my), 0)
  const denX = Math.sqrt(xs.reduce((a, x) => a + (x - mx) ** 2, 0))
  const denY = Math.sqrt(ys.reduce((a, y) => a + (y - my) ** 2, 0))
  return denX * denY === 0 ? 0 : num / (denX * denY)
}

function rLabel(r) {
  const a = Math.abs(r)
  const strength = a > 0.7 ? 'Strong' : a > 0.4 ? 'Moderate' : 'Weak'
  const dir = r < 0 ? 'negative' : 'positive'
  return `${strength} ${dir}`
}

// ── Scatter chart (Sound vs Comfort coloured by class) ────────────
const CLASS_COLORS = {
  QUIET:          '#3B9E72CC',
  LIGHT_ACTIVITY: '#5A52E0CC',
  RESTLESS:       '#F59E0BCC',
  CRYING:         '#EF4444CC',
}

function ScatterChart({ history }) {
  const canvasRef = useRef(null)
  const chartRef  = useRef(null)

  const datasets = useMemo(() => {
    const buckets = { QUIET: [], LIGHT_ACTIVITY: [], RESTLESS: [], CRYING: [] }
    history.forEach(h => {
      const cls = h.soundEvt || 'QUIET'
      if (buckets[cls]) buckets[cls].push({ x: h.soundLv ?? 0, y: h.comfort ?? 0 })
    })
    return Object.entries(buckets).map(([cls, pts]) => ({
      label: cls.replace('_', ' '),
      data: pts,
      backgroundColor: CLASS_COLORS[cls],
      pointRadius: 4,
      pointHoverRadius: 6,
    }))
  }, [history])

  useEffect(() => {
    chartRef.current = new Chart(canvasRef.current.getContext('2d'), {
      type: 'scatter',
      data: { datasets },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: false,
        plugins: {
          legend: {
            labels: { color: '#94A3B8', font: { size: 10 }, boxWidth: 10, padding: 10 },
          },
          tooltip: {
            callbacks: {
              label: ctx => ` Sound: ${ctx.parsed.x}  ·  Comfort: ${ctx.parsed.y}%`,
            },
          },
        },
        scales: {
          x: {
            title: { display: true, text: 'Sound Level (0 – 1023)', color: '#94A3B8', font: { size: 10 } },
            ticks: { color: '#94A3B8', font: { size: 9 } },
            grid:  { color: '#2A2E4A55' },
          },
          y: {
            min: 0, max: 100,
            title: { display: true, text: 'Comfort Score (%)', color: '#94A3B8', font: { size: 10 } },
            ticks: { color: '#94A3B8', font: { size: 9 } },
            grid:  { color: '#2A2E4A55' },
          },
        },
      },
    })
    return () => chartRef.current?.destroy()
  }, []) // eslint-disable-line

  useEffect(() => {
    if (!chartRef.current) return
    chartRef.current.data.datasets = datasets
    chartRef.current.update('none')
  }, [datasets])

  return (
    <div className="bg-white dark:bg-[#1E2236] rounded-2xl border border-nest-border dark:border-[#2A2E4A] p-4 shadow-sm">
      <div className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-3">
        Sound vs Comfort — Live Scatter (coloured by class)
      </div>
      <div style={{ height: 220 }}>
        <canvas ref={canvasRef} />
      </div>
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────
const CLASS_ROWS = [
  { key: 'QUIET',          label: '😴 Quiet',          bar: 'bg-accent'      },
  { key: 'LIGHT_ACTIVITY', label: '🌙 Light Activity',  bar: 'bg-[#5A52E0]'  },
  { key: 'RESTLESS',       label: '😟 Restless',        bar: 'bg-yellow-400' },
  { key: 'CRYING',         label: '😭 Crying',          bar: 'bg-red-400'    },
]

export default function AnalyseCorrelation() {
  const { localHistory, soundDist } = useSensor()
  const history = useMemo(() => localHistory.slice().reverse(), [localHistory])

  const sounds   = history.map(h => h.soundLv   ?? 0)
  const comforts = history.map(h => h.comfort    ?? 0)
  const temps    = history.map(h => h.temp       ?? 0)
  const humids   = history.map(h => h.humidity   ?? 0)

  const rSC = pearsonR(sounds, comforts)
  const rTC = pearsonR(temps,  comforts)
  const rHC = pearsonR(humids, comforts)

  const rCards = [
    { label: 'Sound vs Comfort',    r: rSC, color: '#5A52E0' },
    { label: 'Temp vs Comfort',     r: rTC, color: '#EF4444' },
    { label: 'Humidity vs Comfort', r: rHC, color: '#3B9E72' },
  ]

  const total = Object.values(soundDist).reduce((a, b) => a + b, 0) || 1

  return (
    <div className="flex flex-col gap-4">

      {/* Header */}
      <div className="flex items-center gap-3">
        <span className="text-2xl">🔗</span>
        <div>
          <div className="text-base font-bold text-gray-800 dark:text-gray-100">Correlation Analysis</div>
          <div className="text-xs text-gray-400 mt-0.5">
            Pearson r computed live from session readings · updates every 2 s
          </div>
        </div>
      </div>

      {/* r-value cards */}
      <div className="grid grid-cols-3 gap-3">
        {rCards.map(({ label, r, color }) => (
          <div key={label} className="bg-white dark:bg-[#1E2236] rounded-2xl border border-nest-border dark:border-[#2A2E4A] p-4 shadow-sm">
            <div className="text-[10px] uppercase tracking-widest text-gray-400 mb-2">{label}</div>
            <div className="text-2xl font-extrabold" style={{ color }}>
              {history.length < 3 ? '—' : r.toFixed(3)}
            </div>
            <div className="text-[10px] text-gray-400 mt-1">
              {history.length < 3 ? 'Collecting data…' : rLabel(r)}
            </div>
            {/* strength bar */}
            <div className="mt-2 h-1.5 rounded-full bg-gray-100 dark:bg-[#161928] overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-700"
                style={{ width: `${Math.abs(r) * 100}%`, backgroundColor: color }}
              />
            </div>
          </div>
        ))}
      </div>

      {/* Scatter chart */}
      <ScatterChart history={history} />

      {/* Class distribution */}
      <div className="bg-white dark:bg-[#1E2236] rounded-2xl border border-nest-border dark:border-[#2A2E4A] p-5 shadow-sm">
        <div className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-4">
          Session Class Distribution
        </div>
        <div className="flex flex-col gap-3">
          {CLASS_ROWS.map(({ key, label, bar }) => {
            const count = soundDist[key] || 0
            const pct   = Math.round((count / total) * 100)
            return (
              <div key={key} className="flex items-center gap-3">
                <span className="text-xs text-gray-600 dark:text-gray-300 w-36 flex-shrink-0">{label}</span>
                <div className="flex-1 h-2.5 bg-nest-bg dark:bg-[#161928] rounded-full overflow-hidden">
                  <div className={`${bar} h-full rounded-full transition-all duration-500`} style={{ width: `${pct}%` }} />
                </div>
                <span className="text-[11px] font-semibold text-gray-500 w-10 text-right">{pct}%</span>
                <span className="text-[10px] text-gray-400 w-12 text-right">{count}×</span>
              </div>
            )
          })}
        </div>
      </div>

      {/* Info */}
      <div className="bg-violet-50 dark:bg-violet-900/20 border border-violet-200 dark:border-violet-800/40 rounded-2xl px-5 py-3 text-xs text-violet-700 dark:text-violet-300 leading-relaxed">
        <span className="font-bold">Note:</span> Pearson r updates every 2 s using all readings collected this session.
        A value near −1 means a strong inverse relationship (higher sound = lower comfort).
        The scatter plot colours each point by its ML-classified sound event.
      </div>

    </div>
  )
}
