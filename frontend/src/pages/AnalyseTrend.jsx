import { useRef, useEffect } from 'react'
import { useSensor } from '../context/SensorContext'
import {
  Chart, LineController, LineElement, PointElement,
  LinearScale, CategoryScale, Tooltip, Legend,
} from 'chart.js'

Chart.register(LineController, LineElement, PointElement, LinearScale, CategoryScale, Tooltip, Legend)

// ── Math helpers ──────────────────────────────────────────────────
function rollingAvg(arr, w = 7) {
  return arr.map((_, i) => {
    const slice = arr.slice(Math.max(0, i - w + 1), i + 1)
    return +(slice.reduce((a, b) => a + b, 0) / slice.length).toFixed(2)
  })
}

function linReg(arr) {
  const n = arr.length
  if (n < 2) return arr.slice()
  const meanX = (n - 1) / 2
  const meanY = arr.reduce((a, b) => a + b, 0) / n
  const num = arr.reduce((a, y, i) => a + (i - meanX) * (y - meanY), 0)
  const den = arr.reduce((a, _, i) => a + (i - meanX) ** 2, 0)
  const s = den === 0 ? 0 : num / den
  const b = meanY - s * meanX
  return arr.map((_, i) => +(s * i + b).toFixed(2))
}

function trendDir(arr) {
  if (arr.length < 5) return { dir: '— No data', color: 'text-gray-400' }
  const reg = linReg(arr)
  const delta = reg[reg.length - 1] - reg[0]
  if (delta > 2)  return { dir: '↑ Rising',  color: 'text-green-500' }
  if (delta < -2) return { dir: '↓ Falling', color: 'text-red-500'   }
  return { dir: '→ Stable', color: 'text-gray-400' }
}

// ── Chart component ───────────────────────────────────────────────
function LiveLine({ raw, roll, reg, color, unit, title, yMin, yMax }) {
  const canvasRef  = useRef(null)
  const chartRef   = useRef(null)

  useEffect(() => {
    const ctx = canvasRef.current.getContext('2d')
    chartRef.current = new Chart(ctx, {
      type: 'line',
      data: {
        labels: raw.map((_, i) => i),
        datasets: [
          {
            label: 'Raw',
            data: raw,
            borderColor: color + '55',
            borderWidth: 1.5,
            pointRadius: 0,
            tension: 0.3,
          },
          {
            label: 'Rolling avg (7)',
            data: roll,
            borderColor: color,
            borderWidth: 2.5,
            pointRadius: 0,
            tension: 0.4,
          },
          {
            label: 'Trend',
            data: reg,
            borderColor: '#F59E0B',
            borderWidth: 2,
            borderDash: [6, 4],
            pointRadius: 0,
            tension: 0,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: false,
        plugins: {
          legend: {
            display: true,
            labels: { color: '#94A3B8', font: { size: 10 }, boxWidth: 12, padding: 8 },
          },
          tooltip: {
            callbacks: { label: ctx => ` ${ctx.parsed.y.toFixed(1)}${unit}` },
          },
        },
        scales: {
          x: {
            ticks: { display: false },
            grid: { color: '#2A2E4A33' },
          },
          y: {
            min: yMin,
            max: yMax,
            ticks: {
              color: '#94A3B8',
              font: { size: 10 },
              callback: v => `${v}${unit}`,
            },
            grid: { color: '#2A2E4A55' },
          },
        },
      },
    })
    return () => chartRef.current?.destroy()
  }, []) // eslint-disable-line

  useEffect(() => {
    if (!chartRef.current) return
    chartRef.current.data.labels = raw.map((_, i) => i)
    chartRef.current.data.datasets[0].data = raw
    chartRef.current.data.datasets[1].data = roll
    chartRef.current.data.datasets[2].data = reg
    chartRef.current.update('none')
  }, [raw, roll, reg])

  return (
    <div className="bg-white dark:bg-[#1E2236] rounded-2xl border border-nest-border dark:border-[#2A2E4A] p-4 shadow-sm">
      <div className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-3">{title}</div>
      <div style={{ height: 160 }}>
        <canvas ref={canvasRef} />
      </div>
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────
export default function AnalyseTrend() {
  const { localHistory, temp, soundLevel, comfort } = useSensor()

  const POINTS  = 80
  const history = localHistory.slice(0, POINTS).reverse()   // oldest → newest

  const comfArr = history.map(h => h.comfort  ?? 0)
  const tempArr = history.map(h => h.temp     ?? 0)
  const sndArr  = history.map(h => h.soundLv  ?? 0)

  const comfRoll = rollingAvg(comfArr)
  const tempRoll = rollingAvg(tempArr)
  const sndRoll  = rollingAvg(sndArr)

  const comfReg = linReg(comfArr)
  const tempReg = linReg(tempArr)
  const sndReg  = linReg(sndArr)

  const comfTrend = trendDir(comfArr)
  const tempTrend = trendDir(tempArr)
  const sndTrend  = trendDir(sndArr)

  const stats = [
    { label: 'Comfort',      val: `${comfort}%`,                             trend: comfTrend, color: 'text-accent'      },
    { label: 'Temperature',  val: temp != null ? `${temp.toFixed(1)}°C` : '—', trend: tempTrend, color: 'text-red-400'  },
    { label: 'Sound Level',  val: soundLevel,                                trend: sndTrend,  color: 'text-[#5A52E0]'  },
    { label: 'Data Points',  val: history.length,                            trend: { dir: '● live', color: 'text-gray-400' }, color: 'text-gray-300' },
  ]

  return (
    <div className="flex flex-col gap-4">

      {/* Header */}
      <div className="flex items-center gap-3">
        <span className="text-2xl">📈</span>
        <div>
          <div className="text-base font-bold text-gray-800 dark:text-gray-100">Trend Analysis</div>
          <div className="text-xs text-gray-400 mt-0.5">
            Live rolling average + linear regression · updates every 2 s
          </div>
        </div>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-4 gap-3">
        {stats.map(({ label, val, trend, color }) => (
          <div key={label} className="bg-white dark:bg-[#1E2236] rounded-2xl border border-nest-border dark:border-[#2A2E4A] p-4 shadow-sm">
            <div className="text-[10px] uppercase tracking-widest text-gray-400 mb-1">{label}</div>
            <div className={`text-xl font-extrabold ${color}`}>{val}</div>
            <div className={`text-[10px] mt-1 font-medium ${trend.color}`}>{trend.dir}</div>
          </div>
        ))}
      </div>

      {/* Live charts */}
      <LiveLine
        raw={comfArr} roll={comfRoll} reg={comfReg}
        color="#3B9E72" unit="%" title="Comfort Score — raw · rolling avg · trend"
        yMin={0} yMax={100}
      />
      <LiveLine
        raw={tempArr} roll={tempRoll} reg={tempReg}
        color="#EF4444" unit="°C" title="Room Temperature — raw · rolling avg · trend"
        yMin={undefined} yMax={undefined}
      />
      <LiveLine
        raw={sndArr} roll={sndRoll} reg={sndReg}
        color="#5A52E0" unit="" title="Sound Level — raw · rolling avg · trend"
        yMin={0} yMax={undefined}
      />

      {/* Legend note */}
      <div className="bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-200 dark:border-indigo-800/40 rounded-2xl px-5 py-3 text-xs text-indigo-700 dark:text-indigo-300 leading-relaxed">
        <span className="font-bold">Method:</span> Faint line = raw sensor readings.
        Solid line = 7-point rolling average to reduce noise.
        Dashed amber line = linear regression showing the overall trend direction.
        Showing last {POINTS} readings.
      </div>

    </div>
  )
}
