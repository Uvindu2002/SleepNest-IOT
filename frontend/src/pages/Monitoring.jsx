import { useState, useEffect, useRef } from 'react'
import {
  Chart, LineController, LineElement, PointElement,
  BarController, BarElement,
  LinearScale, CategoryScale, Filler, Tooltip,
} from 'chart.js'
import { useSensor } from '../context/SensorContext'
import { soundToDb } from '../utils/comfort'
import { fmtTime } from '../utils/format'

Chart.register(
  LineController, LineElement, PointElement,
  BarController, BarElement,
  LinearScale, CategoryScale, Filler, Tooltip,
)

// ── Environmental trends: multi-line (temp / humidity / noise) ──
function EnvTrendChart({ history, filters }) {
  const ref      = useRef(null)
  const chartRef = useRef(null)

  const labels   = history.map(h => fmtTime(h.ts))
  const tempData = history.map(h => h.temp ?? null)
  const humData  = history.map(h => h.humidity ?? null)
  const noisData = history.map(h => h.soundPct)

  useEffect(() => {
    const ctx = ref.current.getContext('2d')
    chartRef.current = new Chart(ctx, {
      type: 'line',
      data: {
        labels,
        datasets: [
          {
            label: 'Temperature',
            data: tempData,
            borderColor: '#3B9E72',
            backgroundColor: 'rgba(59,158,114,0.06)',
            borderWidth: 2,
            pointRadius: 3,
            pointBackgroundColor: '#3B9E72',
            tension: 0.4,
            fill: false,
            hidden: !filters.temp,
            yAxisID: 'yLeft',
          },
          {
            label: 'Humidity',
            data: humData,
            borderColor: '#5A52E0',
            backgroundColor: 'rgba(90,82,224,0.06)',
            borderWidth: 2,
            pointRadius: 3,
            pointBackgroundColor: '#5A52E0',
            tension: 0.4,
            fill: false,
            hidden: !filters.humidity,
            yAxisID: 'yRight',
          },
          {
            label: 'Noise',
            data: noisData,
            borderColor: '#F07848',
            backgroundColor: 'rgba(240,120,72,0.06)',
            borderWidth: 2,
            pointRadius: 3,
            pointBackgroundColor: '#F07848',
            tension: 0.4,
            fill: false,
            hidden: !filters.noise,
            yAxisID: 'yRight',
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: false,
        interaction: { mode: 'index', intersect: false },
        plugins: {
          legend: { display: false },
          tooltip: {
            enabled: true,
            callbacks: {
              label: item => {
                const unit = item.datasetIndex === 0 ? '°C' : '%'
                return ` ${item.dataset.label}: ${item.raw ?? '—'}${unit}`
              },
            },
          },
        },
        scales: {
          x: {
            grid: { color: 'rgba(0,0,0,0.04)' },
            ticks: { color: '#94A3B8', font: { size: 10 }, maxTicksLimit: 8, maxRotation: 0 },
          },
          yLeft: {
            position: 'left',
            grid: { color: 'rgba(0,0,0,0.04)' },
            ticks: { color: '#3B9E72', font: { size: 10 }, callback: v => v + '°' },
          },
          yRight: {
            position: 'right',
            min: 0, max: 100,
            grid: { display: false },
            ticks: { color: '#94A3B8', font: { size: 10 }, callback: v => v + '%' },
          },
        },
      },
    })
    return () => chartRef.current?.destroy()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (!chartRef.current) return
    const c = chartRef.current
    c.data.labels              = history.map(h => fmtTime(h.ts))
    c.data.datasets[0].data   = history.map(h => h.temp ?? null)
    c.data.datasets[1].data   = history.map(h => h.humidity ?? null)
    c.data.datasets[2].data   = history.map(h => h.soundPct)
    c.data.datasets[0].hidden = !filters.temp
    c.data.datasets[1].hidden = !filters.humidity
    c.data.datasets[2].hidden = !filters.noise
    c.update('none')
  }, [history, filters])

  return <canvas ref={ref} />
}

// ── PIR motion signal chart ──────────────────────────────────────
function MotionSignalChart({ motionHistory }) {
  const ref      = useRef(null)
  const chartRef = useRef(null)

  useEffect(() => {
    const ctx = ref.current.getContext('2d')
    chartRef.current = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: motionHistory.map(d => fmtTime(d.ts)),
        datasets: [{
          data: motionHistory.map(d => d.val === 1 ? 1 : 0.05),
          backgroundColor: motionHistory.map(d =>
            d.val === 1 ? 'rgba(59,158,114,0.65)' : 'rgba(190,228,210,0.18)',
          ),
          borderColor: motionHistory.map(d =>
            d.val === 1 ? '#3B9E72' : 'transparent',
          ),
          borderWidth: 1,
          borderRadius: 2,
          barPercentage: 1.0,
          categoryPercentage: 1.0,
        }],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              title: items => items[0].label,
              label: item => item.raw >= 0.9 ? '🟢 Motion Detected' : '⚪ No Motion',
            },
          },
        },
        scales: {
          x: {
            grid: { display: false },
            ticks: { color: '#94A3B8', font: { size: 9 }, maxTicksLimit: 6, maxRotation: 0 },
          },
          y: {
            min: 0, max: 1.2,
            grid: { color: 'rgba(0,0,0,0.04)' },
            ticks: {
              color: '#94A3B8',
              font: { size: 10 },
              stepSize: 0.5,
              callback: v => v >= 0.9 ? 'Yes' : v <= 0.1 ? 'No' : '',
            },
          },
        },
      },
    })
    return () => chartRef.current?.destroy()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (!chartRef.current) return
    const c = chartRef.current
    c.data.labels                      = motionHistory.map(d => fmtTime(d.ts))
    c.data.datasets[0].data            = motionHistory.map(d => d.val === 1 ? 1 : 0.05)
    c.data.datasets[0].backgroundColor = motionHistory.map(d =>
      d.val === 1 ? 'rgba(59,158,114,0.65)' : 'rgba(190,228,210,0.18)',
    )
    c.data.datasets[0].borderColor = motionHistory.map(d =>
      d.val === 1 ? '#3B9E72' : 'transparent',
    )
    c.update('none')
  }, [motionHistory])

  return <canvas ref={ref} />
}

// ── Noise vs Motion correlation chart ───────────────────────────
function CorrelationChart({ noiseHistory, motionHistory }) {
  const ref      = useRef(null)
  const chartRef = useRef(null)

  function computeCorrelation(nH, mH) {
    const len    = Math.min(nH.length, mH.length)
    const bins   = ['0–25%', '25–50%', '50–75%', '75–100%']
    const counts = [0, 0, 0, 0]
    const motion = [0, 0, 0, 0]
    for (let i = 0; i < len; i++) {
      const n   = nH[i].val
      const m   = mH[i].val
      const idx = Math.min(3, Math.floor(n / 25))
      counts[idx]++
      if (m === 1) motion[idx]++
    }
    return {
      labels: bins,
      rates: counts.map((c, i) => c === 0 ? 0 : Math.round((motion[i] / c) * 100)),
    }
  }

  const { labels: bLabels, rates } = computeCorrelation(noiseHistory, motionHistory)

  useEffect(() => {
    const ctx = ref.current.getContext('2d')
    chartRef.current = new Chart(ctx, {
      type: 'line',
      data: {
        labels: bLabels,
        datasets: [{
          label: 'Motion rate',
          data: rates,
          borderColor: '#5A52E0',
          backgroundColor: 'rgba(90,82,224,0.08)',
          borderWidth: 2.5,
          pointRadius: 5,
          pointBackgroundColor: '#fff',
          pointBorderColor: '#5A52E0',
          pointBorderWidth: 2,
          tension: 0.4,
          fill: true,
        }],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: { label: item => `Motion: ${item.raw}%` },
          },
        },
        scales: {
          x: {
            grid: { display: false },
            ticks: { color: '#94A3B8', font: { size: 10 } },
          },
          y: {
            min: 0, max: 100,
            grid: { color: 'rgba(0,0,0,0.04)' },
            ticks: { color: '#94A3B8', font: { size: 10 }, callback: v => v + '%' },
          },
        },
      },
    })
    return () => chartRef.current?.destroy()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (!chartRef.current) return
    const { rates: newRates } = computeCorrelation(noiseHistory, motionHistory)
    chartRef.current.data.datasets[0].data = newRates
    chartRef.current.update('none')
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [noiseHistory, motionHistory])

  return <canvas ref={ref} />
}

// ── Filter toggle button ─────────────────────────────────────────
function FilterBtn({ active, color, label, onClick }) {
  return (
    <button
      onClick={onClick}
      className="px-4 py-1.5 rounded-lg text-xs font-semibold border transition-all"
      style={
        active
          ? { backgroundColor: color, borderColor: color, color: '#fff' }
          : { backgroundColor: '#fff', borderColor: '#E2E8F0', color: '#64748B' }
      }
    >
      {label}
    </button>
  )
}

// ── Main page ────────────────────────────────────────────────────
export default function Monitoring() {
  const {
    noiseHistory, motionHistory, localHistory,
    motion, motionCount,
    device, readings,
  } = useSensor()

  const stats       = device?.stats || {}
  const history     = [...localHistory].reverse().slice(0, 60)
  const motionSpikes = motionHistory.filter(h => h.val === 1).length

  const [filters, setFilters] = useState({ temp: true, humidity: true, noise: true })
  const toggle = k => setFilters(f => ({ ...f, [k]: !f[k] }))

  return (
    <div className="flex flex-col gap-5">

      {/* ── Quick stat pills ──────────────────────────────── */}
      <div className="flex items-center gap-3">
        {[
          { label: 'Avg Sound',     val: (stats.avgSoundLevel ?? 0).toFixed(0),  cls: 'bg-emerald-50 dark:bg-[#17302A]',    vcls: 'text-accent' },
          { label: 'Peak Sound',    val: stats.peakSoundRecorded ?? 0,            cls: 'bg-amber-50 dark:bg-yellow-900/20',  vcls: 'text-amber-500' },
          { label: 'Motion Events', val: motionSpikes,                            cls: 'bg-indigo-50 dark:bg-[#1A1E3A]',     vcls: 'text-indigo-500' },
          { label: 'Session Reads', val: stats.totalReadings ?? readings,         cls: 'bg-white dark:bg-[#161928]',         vcls: 'text-gray-700 dark:text-gray-200' },
        ].map(({ label, val, cls, vcls }) => (
          <div key={label} className={`${cls} rounded-xl border border-nest-border dark:border-[#2A2E4A] px-4 py-2 flex items-center gap-2 shadow-sm`}>
            <span className={`text-sm font-extrabold ${vcls}`}>{val}</span>
            <span className="text-[11px] text-gray-400">{label}</span>
          </div>
        ))}
        {motion === 1 && (
          <span className="ml-auto flex items-center gap-1.5 text-xs font-semibold text-accent bg-emerald-50 dark:bg-green-900/20 px-3 py-1.5 rounded-full border border-emerald-200 dark:border-emerald-800">
            <span className="w-1.5 h-1.5 rounded-full bg-accent animate-pulse inline-block" />
            Motion Active
          </span>
        )}
      </div>

      {/* ── Section heading ───────────────────────────────── */}
      <h2 className="text-lg font-bold text-gray-800 dark:text-gray-100 -mb-2">Trend Chart</h2>

      {/* ── Full-width: Environmental Trends ─────────────── */}
      <div className="bg-white dark:bg-[#1E2236] rounded-2xl border-2 border-blue-200 dark:border-[#2A2E4A] p-5 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <div>
            <div className="text-sm font-semibold text-gray-700 dark:text-gray-200">
              Environmental Trends &mdash; past 7 days
            </div>
          </div>
          <div className="flex items-center gap-2">
            <FilterBtn active={filters.temp}     color="#3B9E72" label="Temperature" onClick={() => toggle('temp')} />
            <FilterBtn active={filters.humidity}  color="#5A52E0" label="Humidity"    onClick={() => toggle('humidity')} />
            <FilterBtn active={filters.noise}     color="#F07848" label="Noise"       onClick={() => toggle('noise')} />
          </div>
        </div>
        <div className="h-52 relative">
          {history.length >= 2
            ? <EnvTrendChart history={history} filters={filters} />
            : <div className="flex items-center justify-center h-full text-sm text-gray-400">Collecting data…</div>
          }
        </div>
      </div>

      {/* ── Bottom row: Motion Chart + Correlation ────────── */}
      <div className="grid gap-5" style={{ gridTemplateColumns: '1fr 1fr' }}>

        {/* Motion Chart */}
        <div className="bg-white dark:bg-[#1E2236] rounded-2xl border border-nest-border dark:border-[#2A2E4A] p-5 shadow-sm">
          <div className="mb-3">
            <div className="text-sm font-semibold text-gray-700 dark:text-gray-200">Motion Chart</div>
            <div className="text-xs text-gray-400 mt-0.5">PIR Motion Sensor Output Signal</div>
          </div>
          <div className="h-44 relative">
            {motionHistory.length >= 2
              ? <MotionSignalChart motionHistory={motionHistory} />
              : <div className="flex items-center justify-center h-full text-sm text-gray-400">Collecting…</div>
            }
          </div>
        </div>

        {/* Correlation: Noise vs Motion */}
        <div className="bg-white dark:bg-[#1E2236] rounded-2xl border border-nest-border dark:border-[#2A2E4A] p-5 shadow-sm">
          <div className="mb-3">
            <div className="text-sm font-semibold text-gray-700 dark:text-gray-200">Correlation : Noise vs Motion</div>
            <div className="text-xs text-gray-400 mt-0.5">Motion rate per noise level bucket</div>
          </div>
          <div className="h-44 relative">
            {noiseHistory.length >= 4 && motionHistory.length >= 4
              ? <CorrelationChart noiseHistory={noiseHistory} motionHistory={motionHistory} />
              : <div className="flex items-center justify-center h-full text-sm text-gray-400">Collecting…</div>
            }
          </div>
        </div>

      </div>
    </div>
  )
}
