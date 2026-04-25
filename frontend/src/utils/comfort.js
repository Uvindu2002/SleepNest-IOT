/**
 * Calculate 0-100 comfort score from sensor readings.
 * motionPenalty: 0 = none, 5 = brief motion, 25 = sustained motion ≥ threshold
 */
export function calcComfort(temp, humidity, soundLevel, motionPenalty = 0) {
  if (temp == null) return 0
  const tempScore  = Math.max(0, 100 - Math.abs(temp - 20) * 8)
  const humScore   = humidity != null ? Math.max(0, 100 - Math.abs(humidity - 50) * 2.5) : 60
  const soundScore = Math.max(0, 100 - (soundLevel / 1023) * 100)
  const base = Math.round(tempScore * 0.35 + humScore * 0.25 + soundScore * 0.40)
  return Math.max(0, base - motionPenalty)
}

export function comfortStatus(score) {
  if (score >= 85) return 'Baby is Deeply Resting'
  if (score >= 70) return 'Baby is Sleeping Well'
  if (score >= 55) return 'Baby in Light Sleep'
  if (score >= 40) return 'Baby is Restless'
  return 'Baby Needs Attention'
}

export function comfortEmoji(score) {
  if (score >= 85) return '😴'
  if (score >= 70) return '🌙'
  if (score >= 55) return '😪'
  if (score >= 40) return '😟'
  return '😭'
}

/**
 * Map 0-1023 ESP32 sound level → estimated dB using a logarithmic scale.
 * Log scale gives realistic spread: quiet room ~20-40 dB, crying ~60-80 dB.
 *   Level   0 →  20 dB  (silence)
 *   Level   6 →  40 dB  (QUIET threshold)
 *   Level  20 →  51 dB  (LIGHT_ACTIVITY threshold)
 *   Level  40 →  58 dB  (RESTLESS threshold)
 *   Level  67 →  63 dB  (typical mild cry)
 *   Level 200 →  74 dB  (strong cry)
 *   Level 1023 → 90 dB  (maximum)
 */
export function soundToDb(level) {
  if (level <= 0) return 20
  return Math.round(20 + (Math.log10(1 + level) / Math.log10(1024)) * 70)
}

export function soundEventLabel(event) {
  switch (event) {
    case 'CRYING':         return { icon: '😭', text: 'Crying Detected!', color: 'text-red-500'    }
    case 'RESTLESS':       return { icon: '😟', text: 'Restless',          color: 'text-yellow-500' }
    case 'LIGHT_ACTIVITY': return { icon: '🌙', text: 'Light Activity',    color: 'text-teal-500'   }
    case 'QUIET':          return { icon: '🔕', text: 'Quiet',             color: 'text-gray-400'   }
    default:               return { icon: '🔕', text: 'Quiet',             color: 'text-gray-400'   }
  }
}

export function generateInsights(temp, humidity, soundLevel, soundEvent, lightLevel, motion) {
  const items = []
  const now = new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })

  if (soundEvent === 'CRYING' || soundEvent === 'RESTLESS')
    items.push(`Noise spike at ${now}`)
  if (temp != null && temp > 24)
    items.push('Room Warming — consider ventilation')
  if (temp != null && temp < 18)
    items.push('Room cooling — check heating')
  if (lightLevel > 2000)
    items.push('Dim lights for better sleep')
  if (humidity != null && humidity < 35)
    items.push('Low humidity — consider humidifier')
  if (humidity != null && humidity > 70)
    items.push('High humidity — improve ventilation')
  if (motion === 1)
    items.push('Baby movement detected')
  if (items.length === 0)
    items.push('All conditions optimal 🌟')

  return items
}
