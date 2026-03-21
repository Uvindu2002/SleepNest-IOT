import { useState } from 'react'
import { useSensor } from '../context/SensorContext'
import { fmtDateTime } from '../utils/format'
import { eventBadgeClass } from '../utils/format'

const FILTERS = ['All', 'CRYING', 'RESTLESS', 'LIGHT_ACTIVITY']

const EVENT_ICON = {
  CRYING:         '😭',
  RESTLESS:       '😟',
  LIGHT_ACTIVITY: '🌙',
}

const BORDER_COLOR = {
  CRYING:         'border-l-red-400',
  RESTLESS:       'border-l-yellow-400',
  LIGHT_ACTIVITY: 'border-l-teal-400',
}

export default function Alerts() {
  const { alertLog, setAlertLog } = useSensor()
  const [filter, setFilter] = useState('All')

  const visible = filter === 'All' ? alertLog : alertLog.filter(a => a.event === filter)

  return (
    <div className="flex flex-col">
      {/* Header row */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <span className="text-base font-bold text-gray-800 dark:text-gray-100">🔔 Alert History</span>
          {alertLog.length > 0 && (
            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400">
              {alertLog.length} total
            </span>
          )}
        </div>
        <button
          onClick={() => setAlertLog([])}
          className="px-3 py-1.5 rounded-lg text-xs font-semibold border border-nest-border dark:border-[#2A2E4A] text-gray-500 dark:text-gray-400 bg-white dark:bg-[#1E2236] hover:bg-red-50 hover:text-red-500 hover:border-red-300 transition-colors"
        >
          Clear Log
        </button>
      </div>

      {/* Filter pills */}
      <div className="flex gap-1.5 mb-4 flex-wrap">
        {FILTERS.map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${
              filter === f
                ? 'bg-accent text-white border-accent'
                : 'bg-white dark:bg-[#1E2236] text-gray-500 dark:text-gray-400 border-nest-border dark:border-[#2A2E4A] hover:border-accent hover:text-accent'
            }`}
          >
            {f === 'LIGHT_ACTIVITY' ? '🌙 Light' : f === 'All' ? 'All' : `${EVENT_ICON[f]} ${f.charAt(0) + f.slice(1).toLowerCase()}`}
          </button>
        ))}
      </div>

      {/* List */}
      <div className="flex flex-col gap-2 overflow-y-auto">
        {visible.length === 0 ? (
          <div className="bg-white dark:bg-[#1E2236] rounded-2xl border border-nest-border dark:border-[#2A2E4A] p-10 text-center">
            <div className="text-3xl mb-3">🔕</div>
            <div className="text-sm text-gray-400">No alerts recorded yet. Monitoring is active.</div>
          </div>
        ) : (
          visible.map(a => (
            <div
              key={a.id}
              className={`bg-white dark:bg-[#1E2236] rounded-xl border border-nest-border dark:border-[#2A2E4A] border-l-4 ${BORDER_COLOR[a.event] || 'border-l-gray-300'} px-4 py-3 flex items-center gap-3 text-sm transition-colors`}
            >
              <span className="text-xl flex-shrink-0">{EVENT_ICON[a.event] || '🔔'}</span>
              <span className="flex-1 font-semibold text-gray-800 dark:text-gray-100">
                {a.event.replace('_', ' ')}
              </span>
              <span className={`px-2 py-0.5 rounded-full text-[11px] font-semibold ${eventBadgeClass(a.event)}`}>
                {a.level} · {a.db} dB
              </span>
              <span className="text-[11px] text-gray-400 flex-shrink-0">{fmtDateTime(a.ts)}</span>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
