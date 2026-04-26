import { useMemo, useRef, useEffect } from 'react'
import { useSensor } from '../context/SensorContext'
import {
  Chart, ScatterController, PointElement,
  LinearScale, Tooltip, Legend,
} from 'chart.js'

Chart.register(ScatterController, PointElement, LinearScale, Tooltip, Legend)

// ── Live scatter chart coloured by cluster ────────────────────────
function LiveClusterScatter({ history }) {
  const canvasRef = useRef(null)
  const chartRef  = useRef(null)

  const datasets = useMemo(() => {
    const buckets = { 0: [], 1: [], 2: [] }
    history.forEach(h => {
      const snd = h.soundLv ?? 0
      const c   = snd < 70 ? 0 : snd < 250 ? 1 : 2
      buckets[c].push({ x: snd, y: h.comfort ?? 0 })
    })
    const defs = [
      { label: '😴 Quiet & Comfortable', color: '#3B9E72CC' },
      { label: '🌙 Light Activity',       color: '#5A52E0CC' },
      { label: '😟 Restless / Noisy',     color: '#F59E0BCC' },
    ]
    return defs.map((d, i) => ({
      label: d.label,
      data: buckets[i],
      backgroundColor: d.color,
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
            min: 0,
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
      <div className="flex items-center justify-between mb-3">
        <div className="text-xs font-bold uppercase tracking-widest text-gray-400">
          Live Cluster Scatter — Sound vs Comfort
        </div>
        <div className="flex items-center gap-1.5 text-[10px] text-green-500 font-semibold">
          <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse inline-block" />
          Live
        </div>
      </div>
      <div style={{ height: 220 }}>
        <canvas ref={canvasRef} />
      </div>
    </div>
  )
}

// Cluster definitions discovered by K-Means (k=3, silhouette=0.424)
// Ordered by descending comfort (cluster 0 = highest comfort)
const CLUSTERS = [
  {
    id: 0,
    name: 'Quiet & Comfortable',
    icon: '😴',
    desc: 'Low sound, stable temperature, highest comfort. Typical deep-rest or sleep state.',
    color: '#3B9E72',
    textColor: 'text-accent',
    bg: 'dark:bg-[#17302A]',
    border: 'border-accent/40',
    count: 924,
    soundRange: '< 70',
    comfortAvg: 59.6,
    soundAvg: 59.8,
  },
  {
    id: 1,
    name: 'Light Activity',
    icon: '🌙',
    desc: 'Slightly elevated sound with minor movement. Baby is awake but settled.',
    color: '#5A52E0',
    textColor: 'text-[#5A52E0]',
    bg: 'dark:bg-[#1A1E3A]',
    border: 'border-[#5A52E0]/40',
    count: 1314,
    soundRange: '70 – 250',
    comfortAvg: 57.8,
    soundAvg: 85.0,
  },
  {
    id: 2,
    name: 'Restless / Noisy',
    icon: '😟',
    desc: 'High sound levels, reduced comfort. Crying or significant distress detected.',
    color: '#F59E0B',
    textColor: 'text-yellow-500',
    bg: 'dark:bg-[#1E1A0A]',
    border: 'border-yellow-400/40',
    count: 1075,
    soundRange: '> 250',
    comfortAvg: 47.6,
    soundAvg: 334.1,
  },
]

const TOTAL_SAMPLES = 924 + 1314 + 1075   // 3313

const CHARTS = [
  {
    src: '/reports/cluster_elbow.png',
    title: 'Optimal k — Elbow & Silhouette',
    desc: 'Left: Elbow method — inertia drops sharply then flattens, indicating the optimal cluster count. Right: Silhouette score peaks at k=3 (score=0.424), confirming 3 natural behaviour patterns exist in the data.',
  },
  {
    src: '/reports/cluster_scatter.png',
    title: 'PCA Projection of Clusters',
    desc: '6-dimensional sensor data projected to 2 principal components. Each dot is one 30-second reading. Stars mark cluster centroids. The three groups are visually separable, validating the clustering.',
  },
  {
    src: '/reports/cluster_profiles.png',
    title: 'Cluster Profiles — Mean Feature Values',
    desc: 'Bar charts showing the average value of each sensor feature per cluster. Cluster 0 has the lowest sound and highest comfort; Cluster 2 shows very high sound and low comfort — matching real-world crying/restless events.',
  },
  {
    src: '/reports/cluster_time.png',
    title: 'Cluster Distribution Over Time',
    desc: 'Top: Comfort score coloured by cluster across the full recording period. Bottom: Stacked bar showing what proportion of each time-bin belongs to each cluster — reveals when restless periods occurred.',
  },
]

function clusterFromSound(soundLevel) {
  if (soundLevel < 70)  return CLUSTERS[0]
  if (soundLevel < 250) return CLUSTERS[1]
  return CLUSTERS[2]
}

export default function AnalyseClustering() {
  const { soundLevel, comfort, temp, localHistory, soundDist } = useSensor()
  const history = useMemo(() => localHistory.slice().reverse(), [localHistory])

  const current = clusterFromSound(soundLevel)

  // Session cluster estimates from soundDist
  const distTotal = Object.values(soundDist).reduce((a, b) => a + b, 0) || 1
  const sessionClusters = useMemo(() => [
    { ...CLUSTERS[0], sessionCount: soundDist.QUIET || 0 },
    { ...CLUSTERS[1], sessionCount: (soundDist.LIGHT_ACTIVITY || 0) + (soundDist.RESTLESS || 0) },
    { ...CLUSTERS[2], sessionCount: soundDist.CRYING || 0 },
  ], [soundDist])

  return (
    <div className="flex flex-col gap-4">

      {/* Header */}
      <div className="flex items-center gap-3">
        <span className="text-2xl">🔵</span>
        <div>
          <div className="text-base font-bold text-gray-800 dark:text-gray-100">Behavior Pattern Analysis</div>
          <div className="text-xs text-gray-400 mt-0.5">
            K-Means unsupervised clustering · k=3 · silhouette=0.424 · trained on {TOTAL_SAMPLES.toLocaleString()} readings
          </div>
        </div>
      </div>

      {/* Current cluster card */}
      <div className={`rounded-2xl border ${current.bg} ${current.border} bg-white p-5 shadow-sm`}>
        <div className="flex items-start justify-between">
          <div>
            <div className="text-[10px] uppercase tracking-widest text-gray-400 mb-1">Current Behavior Pattern</div>
            <div className={`text-2xl font-extrabold ${current.textColor}`}>
              {current.icon} {current.name}
            </div>
            <div className="text-xs text-gray-400 mt-1 max-w-xs">{current.desc}</div>
          </div>
          <div className="text-right flex-shrink-0 ml-4">
            <div className="text-[10px] uppercase tracking-widest text-gray-400 mb-1">Cluster</div>
            <div
              className="text-5xl font-extrabold leading-none"
              style={{ color: current.color }}
            >
              {current.id}
            </div>
          </div>
        </div>
        <div className="mt-4 grid grid-cols-3 gap-3">
          <div className="bg-white/40 dark:bg-[#161928]/60 rounded-xl p-3 text-center">
            <div className="text-[10px] text-gray-400 mb-0.5">Sound Level</div>
            <div className="text-lg font-extrabold" style={{ color: current.color }}>{soundLevel}</div>
          </div>
          <div className="bg-white/40 dark:bg-[#161928]/60 rounded-xl p-3 text-center">
            <div className="text-[10px] text-gray-400 mb-0.5">Comfort</div>
            <div className="text-lg font-extrabold" style={{ color: current.color }}>{comfort}%</div>
          </div>
          <div className="bg-white/40 dark:bg-[#161928]/60 rounded-xl p-3 text-center">
            <div className="text-[10px] text-gray-400 mb-0.5">Sound Range</div>
            <div className="text-lg font-extrabold text-gray-600 dark:text-gray-300">{current.soundRange}</div>
          </div>
        </div>
      </div>

      {/* 3 cluster summary cards */}
      <div className="grid grid-cols-3 gap-3">
        {CLUSTERS.map(cl => {
          const pct = Math.round((cl.count / TOTAL_SAMPLES) * 100)
          const isActive = cl.id === current.id
          return (
            <div
              key={cl.id}
              className={`bg-white dark:bg-[#1E2236] rounded-2xl border p-4 shadow-sm transition-all ${
                isActive ? `${cl.border} ring-2` : 'border-nest-border dark:border-[#2A2E4A]'
              }`}
              style={isActive ? { ringColor: cl.color } : {}}
            >
              <div className="flex items-center gap-2 mb-2">
                <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: cl.color }} />
                <span className="text-[10px] uppercase tracking-widest text-gray-400">Cluster {cl.id}</span>
                {isActive && (
                  <span className="ml-auto text-[9px] font-bold px-1.5 py-0.5 rounded-full text-white"
                    style={{ backgroundColor: cl.color }}>NOW</span>
                )}
              </div>
              <div className={`text-sm font-extrabold ${cl.textColor} mb-1`}>{cl.icon} {cl.name}</div>
              <div className="text-[10px] text-gray-400 mb-3 leading-relaxed">{cl.desc}</div>
              <div className="flex justify-between text-[10px] text-gray-400 mb-1">
                <span>Training data</span>
                <span className="font-semibold">{cl.count.toLocaleString()} ({pct}%)</span>
              </div>
              <div className="h-1.5 rounded-full bg-gray-100 dark:bg-[#161928] overflow-hidden">
                <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: cl.color }} />
              </div>
              <div className="mt-2 flex justify-between text-[10px] text-gray-400">
                <span>Avg comfort: <span className="font-semibold text-gray-500">{cl.comfortAvg}</span></span>
                <span>Avg sound: <span className="font-semibold text-gray-500">{cl.soundAvg}</span></span>
              </div>
            </div>
          )
        })}
      </div>

      {/* Session live distribution */}
      <div className="bg-white dark:bg-[#1E2236] rounded-2xl border border-nest-border dark:border-[#2A2E4A] p-5 shadow-sm">
        <div className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-4">
          This Session — Live Cluster Distribution
        </div>
        <div className="flex flex-col gap-3">
          {sessionClusters.map(cl => {
            const pct = Math.round((cl.sessionCount / distTotal) * 100)
            return (
              <div key={cl.id} className="flex items-center gap-3">
                <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: cl.color }} />
                <span className="text-xs text-gray-600 dark:text-gray-300 w-40 flex-shrink-0">
                  {cl.icon} {cl.name}
                </span>
                <div className="flex-1 h-2.5 bg-nest-bg dark:bg-[#161928] rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{ width: `${pct}%`, backgroundColor: cl.color }}
                  />
                </div>
                <span className="text-[11px] font-semibold text-gray-500 w-10 text-right">{pct}%</span>
                <span className="text-[10px] text-gray-400 w-12 text-right">{cl.sessionCount}×</span>
              </div>
            )
          })}
        </div>
        {/* stacked bar */}
        <div className="mt-4 h-4 rounded-full overflow-hidden flex">
          {sessionClusters.map(cl => {
            const pct = Math.round((cl.sessionCount / distTotal) * 100)
            return pct > 0 ? (
              <div key={cl.id} style={{ width: `${pct}%`, backgroundColor: cl.color }}
                   title={`Cluster ${cl.id}: ${pct}%`} />
            ) : null
          })}
        </div>
      </div>

      {/* Live scatter chart */}
      <LiveClusterScatter history={history} />

      {/* Static analysis charts */}
      {CHARTS.map(({ src, title, desc }) => (
        <div key={title} className="bg-white dark:bg-[#1E2236] rounded-2xl border border-nest-border dark:border-[#2A2E4A] p-5 shadow-sm">
          <div className="text-sm font-bold text-gray-700 dark:text-gray-100 mb-1">{title}</div>
          <div className="text-xs text-gray-400 mb-4 leading-relaxed">{desc}</div>
          <img
            src={src}
            alt={title}
            className="w-full rounded-xl border border-nest-border dark:border-[#2A2E4A]"
            onError={e => { e.target.style.display = 'none' }}
          />
        </div>
      ))}

      {/* Info banner */}
      <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800/40 rounded-2xl px-5 py-3 text-xs text-blue-700 dark:text-blue-300 leading-relaxed">
        <span className="font-bold">Method:</span> K-Means clustering (unsupervised learning) was applied to
        6 sensor features: Sound Avg, Sound Max, Temperature, Humidity, Light, Comfort.
        The optimal k=3 was selected using the silhouette score (0.424).
        No labels were used — the 3 patterns emerged purely from the data.
      </div>

    </div>
  )
}
