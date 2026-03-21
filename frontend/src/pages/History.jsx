import { useSensor } from '../context/SensorContext'
import { fmtDateTime, eventBadgeClass } from '../utils/format'

export default function History() {
  const { localHistory, setLocalHistory } = useSensor()

  return (
    <div className="flex flex-col">
      {/* Header row */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <span className="text-base font-bold text-gray-800 dark:text-gray-100">📋 Data History</span>
          {localHistory.length > 0 && (
            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-nest-blue dark:bg-[#1A1E3A] text-[#5A52E0]">
              {localHistory.length} readings
            </span>
          )}
        </div>
        <div className="flex items-center gap-3">
          <span className="text-[11px] text-gray-400">In-session only</span>
          <button
            onClick={() => setLocalHistory([])}
            className="px-3 py-1.5 rounded-lg text-xs font-semibold border border-nest-border dark:border-[#2A2E4A] text-gray-500 bg-white dark:bg-[#1E2236] hover:bg-red-50 hover:text-red-500 hover:border-red-300 transition-colors"
          >
            Clear
          </button>
        </div>
      </div>

      <div className="bg-white dark:bg-[#1E2236] rounded-2xl border border-nest-border dark:border-[#2A2E4A] shadow-sm overflow-hidden">
        <div className="overflow-x-auto h-full overflow-y-auto">
          <table className="w-full text-xs min-w-[700px]">
            <thead className="sticky top-0 z-10">
              <tr className="bg-nest-bg dark:bg-[#161928]">
                {['Time', 'Temp °C', 'Humidity %', 'Sound', 'Sound %', 'Event', 'Motion', 'Light', 'Comfort'].map(h => (
                  <th key={h} className="text-left px-3 py-2.5 text-[10px] font-bold uppercase tracking-wider text-gray-400 border-b border-nest-border dark:border-[#2A2E4A]">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {localHistory.length === 0 ? (
                <tr>
                  <td colSpan={9} className="text-center py-10 text-gray-400">No data yet</td>
                </tr>
              ) : (
                localHistory.map((row, i) => (
                  <tr
                    key={i}
                    className="border-b border-nest-border dark:border-[#2A2E4A] last:border-0 hover:bg-nest-bg dark:hover:bg-[#161928] transition-colors"
                  >
                    <td className="px-3 py-2 text-gray-400 whitespace-nowrap">{fmtDateTime(row.ts)}</td>
                    <td className="px-3 py-2 font-semibold text-gray-800 dark:text-gray-100">
                      {row.temp != null ? row.temp.toFixed(1) : '—'}
                    </td>
                    <td className="px-3 py-2 font-semibold text-gray-800 dark:text-gray-100">
                      {row.humidity != null ? row.humidity.toFixed(1) : '—'}
                    </td>
                    <td className="px-3 py-2 text-gray-800 dark:text-gray-100">{row.soundLv ?? 0}</td>
                    <td className="px-3 py-2 text-gray-800 dark:text-gray-100">{row.soundPct ?? 0}%</td>
                    <td className="px-3 py-2">
                      <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-semibold ${eventBadgeClass(row.soundEvt)}`}>
                        {row.soundEvt || 'QUIET'}
                      </span>
                    </td>
                    <td className="px-3 py-2">{row.motion === 1 ? '🔴' : '⚪'}</td>
                    <td className="px-3 py-2 text-gray-600 dark:text-gray-300">{row.light ?? '—'}</td>
                    <td className="px-3 py-2">
                      <span className={`font-bold ${row.comfort >= 70 ? 'text-accent' : row.comfort >= 50 ? 'text-yellow-500' : 'text-red-500'}`}>
                        {row.comfort}%
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
