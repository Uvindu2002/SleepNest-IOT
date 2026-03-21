import { useSensor } from '../../context/SensorContext'
import { generateInsights } from '../../utils/comfort'

export default function Insights() {
  const { temp, humidity, soundLevel, soundEvent, light, motion } = useSensor()
  const items = generateInsights(temp, humidity, soundLevel, soundEvent, light, motion)

  return (
    <div className="bg-white dark:bg-[#1E2236] border border-nest-border dark:border-[#2A2E4A] rounded-2xl p-4 shadow-sm transition-colors">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div>
          <div className="text-sm font-bold text-gray-800 dark:text-gray-100">💡 Smart Insights</div>
          <div className="text-[10px] text-gray-400 mt-0.5">Recommended actions</div>
        </div>
        <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-nest-cream dark:bg-[#161928] text-gray-500 dark:text-gray-400">
          {items.length} tip{items.length !== 1 ? 's' : ''}
        </span>
      </div>

      <div className="flex flex-col divide-y divide-nest-border dark:divide-[#2A2E4A]">
        {items.map((item, i) => (
          <div key={i} className="flex items-start gap-2.5 py-2 first:pt-0 last:pb-0">
            <span className="w-4 h-4 rounded-full bg-accent/10 flex items-center justify-center flex-shrink-0 mt-0.5">
              <span className="w-1.5 h-1.5 rounded-full bg-accent inline-block" />
            </span>
            <span className="text-xs text-gray-600 dark:text-gray-300 leading-snug">{item}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
