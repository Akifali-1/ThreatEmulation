interface SparklineProps {
  values: number[]
  /** Fixed domain max; defaults to the data max (min 1 to avoid a flat zero baseline). */
  max?: number
  width?: number
  height?: number
  className?: string
  stroke?: string
}

/**
 * Tiny inline trend line for KPI tiles. Hand-drawn SVG rather than Recharts — at this size a
 * chart library would add weight and axes are not wanted.
 */
export function Sparkline({
  values,
  max,
  width = 72,
  height = 20,
  className = '',
  stroke = 'var(--blue)',
}: SparklineProps) {
  if (values.length < 2) return null

  const domainMax = Math.max(max ?? Math.max(...values), 1)
  const stepX = width / (values.length - 1)
  const points = values.map((value, i) => {
    const x = i * stepX
    const y = height - (Math.max(0, Math.min(value, domainMax)) / domainMax) * height
    return [x, y] as const
  })

  const line = points.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(' ')
  const area = `${line} ${width},${height} 0,${height}`

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      className={className}
      aria-hidden="true"
      preserveAspectRatio="none"
    >
      <polygon points={area} fill={stroke} opacity="0.1" />
      <polyline points={line} fill="none" stroke={stroke} strokeWidth="1.5" strokeLinejoin="round" />
    </svg>
  )
}
