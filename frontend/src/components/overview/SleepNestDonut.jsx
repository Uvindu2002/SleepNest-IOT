import { useEffect, useRef } from 'react'
import { Chart, DoughnutController, ArcElement, Tooltip } from 'chart.js'
import { useSensor } from '../../context/SensorContext'
import { comfortEmoji } from '../../utils/comfort'

Chart.register(DoughnutController, ArcElement, Tooltip)

// Color tier matching StatusCard
function getTier(score) {
  if (score >= 85) return { color: '#3B9E72', track: 'rgba(59,158,114,0.15)',  label: '😴 Deep Rest',   badge: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300' }
  if (score >= 70) return { color: '#0D9488', track: 'rgba(13,148,136,0.15)',  label: '🌙 Sleeping Well', badge: 'bg-teal-100    text-teal-700    dark:bg-teal-900/30    dark:text-teal-300'    }
  if (score >= 55) return { color: '#5A52E0', track: 'rgba(90,82,224,0.15)',   label: '😪 Light Sleep',  badge: 'bg-indigo-100  text-indigo-700  dark:bg-indigo-900/30  dark:text-indigo-300'  }
  if (score >= 40) return { color: '#F59E0B', track: 'rgba(245,158,11,0.15)',  label: '😟 Restless',     badge: 'bg-amber-100   text-amber-700   dark:bg-amber-900/30   dark:text-amber-300'   }
  return           { color: '#EF4444', track: 'rgba(239,68,68,0.15)',           label: '😭 Needs Attention', badge: 'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400' }
}

export default function SleepNestDonut({ style }) {
  const { comfort, device, connected } = useSensor()
  const canvasRef = useRef(null)
  const chartRef  = useRef(null)
  const tier = getTier(comfort)
  const emoji = comfortEmoji(comfort)

  useEffect(() => {
    const ctx = canvasRef.current.getContext('2d')
    chartRef.current = new Chart(ctx, {
      type: 'doughnut',
      data: {
        datasets: [{
          data: [comfort, 100 - comfort],
          backgroundColor: [tier.color, tier.track],
          borderWidth: 0,
          circumference: 280,
          rotation: 220,
        }],
      },
      options: {
        responsive: false,
        cutout: '72%',
        plugins: { legend: { display: false }, tooltip: { enabled: false } },
        animation: { duration: 700, easing: 'easeInOutQuart' },
      },
    })
    return () => chartRef.current?.destroy()
  }, [])

  useEffect(() => {
    if (!chartRef.current) return
    const t = getTier(comfort)
    chartRef.current.data.datasets[0].data            = [comfort, 100 - comfort]
    chartRef.current.data.datasets[0].backgroundColor = [t.color, t.track]
    chartRef.current.update('active')
  }, [comfort])

  return (
    <div
      style={style}
      className="bg-white dark:bg-[#1E2236] rounded-2xl border border-nest-border dark:border-[#2A2E4A] p-4 flex flex-col items-center gap-3 shadow-sm transition-colors"
    >
      {/* Header */}
      <div className="w-full flex items-center justify-between">
        <span className="text-sm font-bold text-gray-800 dark:text-gray-100">🌿 Sleep Nest</span>
        <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full ${tier.badge}`}>
          {tier.label}
        </span>
      </div>

      {/* Donut + center label */}
      <div className="relative w-40 h-40">
        <canvas ref={canvasRef} width={160} height={160} />
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-0.5">
          <span className="text-2xl leading-none">{emoji}</span>
          <span
            className="text-3xl font-extrabold leading-none"
            style={{ color: tier.color }}
          >
            {comfort}%
          </span>
          <span className="text-[10px] text-gray-400">Comfort</span>
        </div>
      </div>

      {/* Comfort bar */}
      <div className="w-full px-1">
        <div className="flex justify-between text-[9px] text-gray-400 mb-1">
          <span>Score</span>
          <span style={{ color: tier.color }} className="font-semibold">{comfort}/100</span>
        </div>
        <div className="h-1.5 rounded-full bg-black/[0.07] dark:bg-white/10 overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-700"
            style={{ width: `${comfort}%`, background: tier.color }}
          />
        </div>
      </div>

      {/* Device + connection */}
      <div className="w-full flex items-center justify-between px-1">
        <span className="text-[10px] text-gray-400 truncate max-w-[120px]">
          {device?.deviceId || 'Connecting…'}
        </span>
        <div className="flex items-center gap-1.5">
          <span
            className={`inline-block w-1.5 h-1.5 rounded-full ${connected ? 'bg-accent live-dot' : 'bg-red-400'}`}
          />
          <span className="text-[10px] font-semibold" style={{ color: connected ? tier.color : '#EF4444' }}>
            {connected ? 'Live' : 'Offline'}
          </span>
        </div>
      </div>
    </div>
  )
}
