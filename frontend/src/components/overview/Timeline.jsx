import { useSensor } from '../../context/SensorContext'
import { fmtTime } from '../../utils/format'

const dotCls = {
  motion: 'bg-[#F07848]',
  sound:  'bg-[#7B76CF]',
  quiet:  'bg-gray-300',
}

export default function Timeline() {
  const { timeline } = useSensor()

  return (
    <div className="bg-white dark:bg-[#1E2236] rounded-2xl border border-nest-border dark:border-[#2A2E4A] p-4 shadow-sm transition-colors overflow-y-auto">
      <div className="flex items-center justify-between mb-3 sticky top-0 bg-white dark:bg-[#1E2236] pb-1 z-10">
        <span className="text-sm font-bold text-gray-800 dark:text-gray-100">🕐 Gentle Timeline</span>
        {timeline.length > 0 && (
          <span className="text-[9px] font-semibold px-2 py-0.5 rounded-full bg-nest-cream dark:bg-[#161928] text-gray-400">
            {timeline.length} events
          </span>
        )}
      </div>

      {timeline.length === 0 ? (
        <p className="text-xs text-gray-400 py-2">Monitoring started… events will appear here.</p>
      ) : (
        <div className="flex flex-col">
          {timeline.map((item, idx) => (
            <div key={item.id} className="flex gap-2 relative pb-4 last:pb-0">
              {/* Vertical connector */}
              {idx < timeline.length - 1 && (
                <span className="absolute left-[47px] top-5 bottom-0 w-0.5 bg-nest-border dark:bg-[#2A2E4A]" />
              )}

              {/* Time */}
              <span className="text-[10px] text-gray-400 w-10 flex-shrink-0 pt-1 text-right leading-none">
                {fmtTime(item.ts)}
              </span>

              {/* Dot */}
              <span className={`w-4 h-4 rounded-full flex-shrink-0 mt-1 ${dotCls[item.type] ?? dotCls.quiet}`} />

              {/* Content */}
              <div className="flex-1 min-w-0">
                <div className="text-xs font-semibold text-gray-800 dark:text-gray-100 leading-tight">
                  {item.event}
                </div>
                <div className="text-[10px] text-gray-400 mt-0.5 leading-tight break-words">
                  {item.cause}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
