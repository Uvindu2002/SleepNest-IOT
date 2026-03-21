export function fmtTime(ts) {
  const d = new Date(ts)
  return d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false })
}

export function fmtDateTime(ts) {
  const d = new Date(ts)
  return d.toLocaleString('en-US', {
    month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false,
  })
}

export function fmtTemp(val) {
  return val != null ? `${val.toFixed(1)} °C` : '—'
}

export function fmtHum(val) {
  return val != null ? `${val.toFixed(1)} %` : '—'
}

export function eventBadgeClass(event) {
  switch (event) {
    case 'CRYING':         return 'bg-red-100 text-red-600'
    case 'RESTLESS':       return 'bg-yellow-100 text-yellow-700'
    case 'LIGHT_ACTIVITY': return 'bg-teal-100 text-teal-700'
    default:               return 'bg-green-100 text-green-700'
  }
}
