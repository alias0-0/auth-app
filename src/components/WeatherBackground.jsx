import { useMemo } from 'react'

export default function WeatherBackground({ condition = 'clear', isNight = false }) {
  // Generate particles deterministically using useMemo instead of useState+useEffect
  const particles = useMemo(() => {
    let count = 0
    if (condition === 'rain') count = 50
    else if (condition === 'snow') count = 40
    else if (isNight) count = 30
    else if (condition === 'clouds') count = 5

    return Array.from({ length: count }).map((_, i) => ({
      id: i,
      left: `${((i * 73 + 17) % 100)}%`,
      top: `${((i * 37 + 11) % 100)}%`,
      delay: `${((i * 0.31) % 4).toFixed(2)}s`,
      duration: `${(1.5 + (i * 0.23) % 3).toFixed(2)}s`,
      size: `${2 + (i % 5)}px`
    }))
  }, [condition, isNight])

  const getThemeClass = () => {
    if (isNight) return 'weather-bg-night'
    switch (condition) {
      case 'rain': return 'weather-bg-rain'
      case 'snow': return 'weather-bg-snow'
      case 'clouds': return 'weather-bg-clouds'
      default: return 'weather-bg-sunny'
    }
  }

  return (
    <div className={`weather-bg-container ${getThemeClass()}`}>
      {condition === 'rain' && (
        <div className="rain-system">
          {particles.map(p => (
            <div
              key={p.id}
              className="rain-drop-particle"
              style={{
                left: p.left,
                animationDelay: p.delay,
                animationDuration: `${(parseFloat(p.duration) * 0.4).toFixed(2)}s`
              }}
            />
          ))}
        </div>
      )}

      {condition === 'snow' && (
        <div className="snow-system">
          {particles.map(p => (
            <div
              key={p.id}
              className="snow-flake-particle"
              style={{
                left: p.left,
                width: p.size,
                height: p.size,
                animationDelay: p.delay,
                animationDuration: p.duration
              }}
            />
          ))}
        </div>
      )}

      {isNight && (
        <div className="stars-system">
          {particles.map(p => (
            <div
              key={p.id}
              className="star-blink-particle"
              style={{
                left: p.left,
                top: p.top,
                width: `${(parseFloat(p.size) * 0.5).toFixed(1)}px`,
                height: `${(parseFloat(p.size) * 0.5).toFixed(1)}px`,
                animationDelay: p.delay,
                animationDuration: `${(parseFloat(p.duration) * 1.5).toFixed(2)}s`
              }}
            />
          ))}
        </div>
      )}

      {condition === 'clouds' && (
        <div className="cloud-drift-system">
          {particles.map(p => (
            <div
              key={p.id}
              className="cloud-sheet-particle"
              style={{
                top: `${parseFloat(p.top) * 0.8}%`,
                animationDelay: p.delay,
                animationDuration: `${(parseFloat(p.duration) * 15).toFixed(2)}s`,
                opacity: 0.15
              }}
            />
          ))}
        </div>
      )}

      {condition === 'clear' && !isNight && (
        <div className="sunny-landscape">
          <div className="cloud-sheet-particle cloud-sunny-1" />
          <div className="cloud-sheet-particle cloud-sunny-2" />
          <div className="landscape-scene">
            <div className="tree-trunk">
              <div className="tree-foliage" />
            </div>
            <div className="squirrel-peek" title="Hello!">🐿️</div>
          </div>
        </div>
      )}
    </div>
  )
}
