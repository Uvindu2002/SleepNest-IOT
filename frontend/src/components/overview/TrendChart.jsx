import { useEffect, useRef } from 'react'
import {
  Chart, LineController, LineElement, PointElement,
  BarController, BarElement,
  LinearScale, CategoryScale, Filler, Tooltip,
} from 'chart.js'
import { useSensor } from '../../context/SensorContext'
import { fmtTime } from '../../utils/format'

Chart.register(
  LineController, LineElement, PointElement,
  BarController, BarElement,
  LinearScale, CategoryScale, Filler, Tooltip,
)

// ── Smooth line chart (temp / noise) ─────────────────────────
function MiniLine({ data, color, bg, min, max, unit, canvasId }) {
  const ref      = useRef(null)
  const chartRef = useRef(null)

  useEffect(() => {
    const ctx = ref.current.getContext('2d')
    chartRef.current = new Chart(ctx, {
      type: 'line',
      data: {
        labels: data.map((_, i) => i),
        datasets: [{
          data: data.map(d => d.val),
          borderColor: color,
          backgroundColor: bg,
          borderWidth: 2,
          pointRadius: 0,
          fill: true,
          tension: 0.4,
        }],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: false,
        plugins: { legend: { display: false }, tooltip: { enabled: false } },
        scales: {
          x: { display: false },
          y: {
            display: true,
            min, max,
            grid: { color: 'rgba(0,0,0,0.04)' },
            ticks: {
              color: '#94A3B8',
              font: { size: 9 },
              maxTicksLimit: 3,
              callback: v => v + (unit || ''),
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
    chartRef.current.data.labels   = data.map((_, i) => i)
    chartRef.current.data.datasets[0].data = data.map(d => d.val)
    chartRef.current.update('none')
  }, [data])

  return <canvas ref={ref} id={canvasId} />
}

// ── Stepped bar chart for motion events ──────────────────────
function MotionChart({ data }) {
  const ref      = useRef(null)
  const chartRef = useRef(null)

  useEffect(() => {
    const ctx = ref.current.getContext('2d')
    chartRef.current = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: data.map(d => fmtTime(d.ts)),
        datasets: [{
          data: data.map(d => d.val),
          backgroundColor: data.map(d =>
            d.val === 1 ? 'rgba(255,120,80,0.80)' : 'rgba(190,228,210,0.30)',
          ),
          borderColor: data.map(d =>
            d.val === 1 ? '#E85A30' : 'transparent',
          ),
          borderWidth: 1,
          borderRadius: 2,
          barPercentage: 0.9,
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
            enabled: true,
            callbacks: {
              title: items => items[0].label,
              label: item => item.raw === 1 ? '🔴 Motion Active' : '⚪ No Motion',
            },
          },
        },
        scales: {
          x: {
            display: true,
            grid: { display: false },
            ticks: {
              color: '#94A3B8',
              font: { size: 8 },
              maxTicksLimit: 6,
              maxRotation: 0,
            },
          },
          y: {
            display: true,
            min: 0,
            max: 1,
            grid: { color: 'rgba(0,0,0,0.04)' },
            ticks: {
              color: '#94A3B8',
              font: { size: 9 },
              stepSize: 1,
              callback: v => v === 1 ? 'Active' : 'None',
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
    chartRef.current.data.labels = data.map(d => fmtTime(d.ts))
    chartRef.current.data.datasets[0].data = data.map(d => d.val)
    chartRef.current.data.datasets[0].backgroundColor = data.map(d =>
      d.val === 1 ? 'rgba(255,120,80,0.80)' : 'rgba(190,228,210,0.30)',
    )
    chartRef.current.data.datasets[0].borderColor = data.map(d =>
      d.val === 1 ? '#E85A30' : 'transparent',
    )
    chartRef.current.update('none')
  }, [data])

  return <canvas ref={ref} />
}

// ── Main TrendChart card ──────────────────────────────────────
export default function TrendChart({ style, className }) {
  const { tempHistory, noiseHistory, motionHistory, motionCount, motion } = useSensor()

  // Count active motion periods in current history window
  const motionSpikes = motionHistory.filter(h => h.val === 1).length

  return (
    <div
      style={style}
      className={`bg-white dark:bg-[#1E2236] rounded-2xl border border-nest-border dark:border-[#2A2E4A] p-4 shadow-sm transition-colors flex flex-col${className ? ' ' + className : ''}`}
    >
      <div className="text-sm font-bold text-gray-800 dark:text-gray-100 mb-3">Trend Chart</div>

      {/* ── Temperature waves ─────────────────────────── */}
      <div className="mb-3">
        <div className="flex items-center justify-between mb-1">
          <span className="text-[11px] text-gray-400">🌡️ Temperature Waves</span>
          <span className="text-[10px] text-gray-300 dark:text-gray-500">Last 2 min</span>
        </div>
        <div className="h-16 relative">
          <MiniLine data={tempHistory} color="#3B9E72" bg="rgba(59,158,114,0.10)" canvasId="temp-chart" unit="°" />
        </div>
      </div>

      {/* ── Noise waves ───────────────────────────────── */}
      <div className="mb-3">
        <div className="flex items-center justify-between mb-1">
          <span className="text-[11px] text-gray-400">🔊 Noise Waves</span>
          <span className="text-[10px] text-gray-300 dark:text-gray-500">Last 2 min</span>
        </div>
        <div className="h-16 relative">
          <MiniLine data={noiseHistory} color="#5A52E0" bg="rgba(90,82,224,0.10)" min={0} max={100} canvasId="noise-chart" unit="%" />
        </div>
      </div>

      {/* ── Motion detection — fills remaining space ──── */}
      <div className="flex flex-col">
        <div className="flex items-center justify-between mb-1">
          <div className="flex items-center gap-2">
            <span className="text-[11px] text-gray-400">🚶 Motion Detection</span>
            {motion === 1 && (
              <span className="flex items-center gap-1 text-[10px] font-semibold text-orange-500 bg-orange-50 dark:bg-orange-900/20 px-2 py-0.5 rounded-full">
                <span className="w-1.5 h-1.5 rounded-full bg-orange-500 animate-pulse inline-block" />
                ACTIVE
              </span>
            )}
          </div>
          <div className="flex items-center gap-3">
            <span className="text-[10px] text-gray-400">
              <span className="font-semibold text-orange-400">{motionSpikes}</span> events
            </span>
            <span className="text-[10px] text-gray-400">
              Session: <span className="font-semibold text-gray-600 dark:text-gray-300">{motionCount}</span>
            </span>
          </div>
        </div>

        {/* Motion bar chart — stretches to fill remaining card height */}
        <div className="relative">
          <MotionChart data={motionHistory} />
        </div>

        <div className="flex items-center gap-4 mt-1.5">
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-sm bg-[rgba(255,120,80,0.80)] inline-block" />
            <span className="text-[10px] text-gray-400">Motion active</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-sm bg-[rgba(190,228,210,0.5)] border border-nest-border inline-block" />
            <span className="text-[10px] text-gray-400">No motion</span>
          </div>
        </div>
      </div>
    </div>
  )
}
