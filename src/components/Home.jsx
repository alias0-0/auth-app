/* eslint-disable react-hooks/exhaustive-deps */
import { useState, useCallback, useEffect } from 'react'
import { 
  LogOut, ShieldCheck, Save, CheckCircle2, 
  ShieldAlert, Sparkles, Sun, Moon, Cloud, CloudRain, 
  Snowflake, Search, Plus, Trash2, Wind, Droplets,
  RefreshCw, Compass
} from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../supabaseClient'
import { fetchWeatherData, getMockWeatherData } from '../services/weatherService'
import WeatherBackground from './WeatherBackground'

export default function Home({ onViewChange }) {
  const { user, signOut } = useAuth()

  // ─── Weather state ───────────────────────────────────────────────────────────
  const [cityInput, setCityInput]       = useState('')
  const [weatherData, setWeatherData]   = useState(null)
  const [weatherLoading, setWeatherLoading] = useState(true)
  const [weatherError, setWeatherError] = useState('')

  // Demo sandbox overrides
  const [demoCondition, setDemoCondition] = useState(null)
  const [demoIsNight,   setDemoIsNight]   = useState(null)

  // Favorites comparison
  const [favoritesData,    setFavoritesData]    = useState([])
  const [favoritesLoading, setFavoritesLoading] = useState(false)

  // ─── Profile / Notepad state ─────────────────────────────────────────────────
  const [personalNote,    setPersonalNote]    = useState(() => localStorage.getItem(`secure_notes_${user?.id}`) || '')
  const [noteSavedMsg,    setNoteSavedMsg]    = useState(false)
  const [displayName,     setDisplayName]     = useState(() => user?.user_metadata?.display_name || user?.email?.split('@')[0] || '')
  const [avatarEmoji,     setAvatarEmoji]     = useState(() => user?.user_metadata?.avatar_emoji || '🚀')
  const [profileSavedMsg, setProfileSavedMsg] = useState(false)
  const [updatingProfile, setUpdatingProfile] = useState(false)

  const [logs, setLogs] = useState(() => [
    { id: 1, action: 'Secure session initialized',    time: 'Just now', type: 'system' },
    { id: 2, action: 'Authentication token verified', time: '1m ago',   type: 'auth'   },
    { id: 3, action: 'Successful portal login',       time: '2m ago',   type: 'auth'   },
  ])

  const emojis        = ['🚀', '💻', '🧠', '⚡', '🎨', '🦁']
  const favoriteCities = user?.user_metadata?.favorite_cities || ['Dubai', 'London']
  const lastCity       = user?.user_metadata?.last_city       || 'Saudi Arabia'

  // ─── loadWeather (declared before effects that reference it) ─────────────────
  const loadWeather = useCallback(async (cityToLoad) => {
    setWeatherLoading(true)
    setWeatherError('')
    try {
      const data = await fetchWeatherData(cityToLoad)
      setWeatherData(data)
      if (user && data.current.name.toLowerCase() !== lastCity.toLowerCase()) {
        await supabase.auth.updateUser({ data: { last_city: data.current.name } })
      }
    } catch {
      setWeatherError('City not found or API limits exceeded.')
      setWeatherData(prev => prev ?? getMockWeatherData(cityToLoad))
    } finally {
      setWeatherLoading(false)
    }
  }, [user, lastCity])

  // ─── loadFavoritesComparison (declared before effects that reference it) ─────
  const loadFavoritesComparison = useCallback(async () => {
    if (favoriteCities.length === 0) {
      setFavoritesData([])
      return
    }
    setFavoritesLoading(true)
    try {
      const results = await Promise.all(
        favoriteCities.map(async (city) => {
          try {
            const res = await fetchWeatherData(city)
            return { name: res.current.name, temp: res.current.temp, condition: res.current.condition }
          } catch {
            const mock = getMockWeatherData(city)
            return { name: mock.current.name, temp: mock.current.temp, condition: mock.current.condition }
          }
        })
      )
      setFavoritesData(results)
    } catch (e) {
      console.warn('Comparison loader issue', e)
    } finally {
      setFavoritesLoading(false)
    }
  }, [favoriteCities])

  // ─── Effects ─────────────────────────────────────────────────────────────────
  useEffect(() => { ;(async () => { if (user) await loadWeather(lastCity) })() }, [user])
  useEffect(() => { ;(async () => { await loadFavoritesComparison() })() },       [user?.user_metadata?.favorite_cities])

  // ─── Event handlers ──────────────────────────────────────────────────────────
  const handleSearchSubmit = (e) => {
    e.preventDefault()
    if (cityInput.trim()) { loadWeather(cityInput.trim()); setCityInput('') }
  }

  const addLog = (action, type = 'system') =>
    setLogs(prev => [{ id: Date.now(), action, time: 'Just now', type }, ...prev])

  const handleAddFavorite = async () => {
    if (!weatherData) return
    const name = weatherData.current.name
    if (favoriteCities.some(c => c.toLowerCase() === name.toLowerCase())) return
    addLog(`Added ${name} to favorites`)
    await supabase.auth.updateUser({ data: { favorite_cities: [...favoriteCities, name] } })
  }

  const handleRemoveFavorite = async (cityToRemove) => {
    const updated = favoriteCities.filter(c => c.toLowerCase() !== cityToRemove.toLowerCase())
    addLog(`Removed ${cityToRemove} from favorites`)
    await supabase.auth.updateUser({ data: { favorite_cities: updated } })
  }

  const handleSaveNote = () => {
    localStorage.setItem(`secure_notes_${user.id}`, personalNote)
    setNoteSavedMsg(true)
    addLog('Notepad entries saved', 'notepad')
    setTimeout(() => setNoteSavedMsg(false), 2000)
  }

  const handleUpdateProfile = async (e) => {
    e.preventDefault()
    setUpdatingProfile(true)
    setProfileSavedMsg(false)
    try {
      const { error } = await supabase.auth.updateUser({ data: { display_name: displayName, avatar_emoji: avatarEmoji } })
      if (error) throw error
      setProfileSavedMsg(true)
      addLog('Profile customizer updated', 'profile')
      setTimeout(() => setProfileSavedMsg(false), 2000)
    } catch (err) {
      console.error(err)
    } finally {
      setUpdatingProfile(false)
    }
  }

  const handleLogout = async () => {
    try { await signOut(); onViewChange('login') }
    catch (err) { console.error(err) }
  }

  // ─── Helpers ─────────────────────────────────────────────────────────────────
  const getWeatherIcon = (cond, isNightTime, size = 20) => {
    if (isNightTime) return <Moon size={size} style={{ color: '#818cf8' }} />
    switch (cond) {
      case 'rain':   return <CloudRain  size={size} style={{ color: '#3b82f6' }} />
      case 'snow':   return <Snowflake  size={size} style={{ color: '#60a5fa' }} />
      case 'clouds': return <Cloud      size={size} style={{ color: '#94a3b8' }} />
      default:       return <Sun        size={size} style={{ color: '#f59e0b' }} />
    }
  }

  const getGreeting = () => {
    const hr = new Date().getHours()
    if (hr < 12) return 'Good morning'
    if (hr < 18) return 'Good afternoon'
    return 'Good evening'
  }

  const isNight        = demoIsNight !== null ? demoIsNight : (new Date().getHours() >= 19 || new Date().getHours() < 6)
  const currentCondition = demoCondition || weatherData?.current?.condition || 'clear'
  const currentTemp      = weatherData?.current?.temp      ?? 25
  const currentCityName  = weatherData?.current?.name      || 'SAUDI ARABIA'
  const currentDesc      = weatherData?.current?.description || 'clear sky'

  const getOutfitSuggestion = () => {
    if (currentCondition === 'rain')  return 'It is currently raining. Be sure to carry an umbrella ☔.'
    if (currentCondition === 'snow')  return 'It is snowing! Bundle up and wear waterproof boots 🥾.'
    if (currentTemp < 15)             return 'It is cool outside. Wear a warm jacket or coat 🧥.'
    if (currentTemp > 30)             return 'It is hot! Wear light, breathable clothes and stay hydrated 🥤.'
    return 'The temperature is pleasant. Comfortable casual wear is perfect 👕.'
  }

  const getActivitySuggestion = () => {
    if (currentCondition === 'rain' || currentCondition === 'snow') return 'Great day to stay in, make hot tea, and read a good book 📖.'
    if (currentTemp >= 15 && currentTemp <= 28) return 'Perfect for outdoor sports, jogging, or a walk in the park 🏃‍♂️.'
    if (currentTemp > 30)  return 'Great day for swimming or relaxing indoors with air conditioning 🏊‍♂️.'
    return 'Nice weather for exploring or wrapping up errands 🚶‍♂️.'
  }

  const getAqiText = (index) => {
    const map = { 1: ['Good', '#10b981'], 2: ['Fair', '#84cc16'], 3: ['Moderate', '#f59e0b'], 4: ['Poor', '#f97316'], 5: ['Severe', '#ef4444'] }
    const [text, color] = map[index] || ['Good', '#10b981']
    return { text, color }
  }

  // Sunrise/Sunset arc position
  const getSunPosition = () => {
    if (isNight) return null
    const now = new Date()
    const currentMin = now.getHours() * 60 + now.getMinutes()
    const parseTimeToMin = (timeStr) => {
      if (!timeStr) return 0
      const [time, modifier] = timeStr.split(' ')
      let [hours, minutes] = time.split(':').map(Number)
      if (modifier === 'PM' && hours < 12) hours += 12
      if (modifier === 'AM' && hours === 12) hours = 0
      return hours * 60 + minutes
    }
    const riseMin = parseTimeToMin(weatherData?.current?.sunrise) || 330
    const setMin  = parseTimeToMin(weatherData?.current?.sunset)  || 1130
    if (currentMin < riseMin || currentMin > setMin) return null
    const ratio = (currentMin - riseMin) / (setMin - riseMin)
    const angle = Math.PI - ratio * Math.PI
    return { x: 50 - 35 * Math.cos(angle), y: 45 - 35 * Math.sin(angle) }
  }

  // 24-hour chart polyline points
  const getChartPoints = () => {
    const data = weatherData?.hourly
    if (!data?.length) return ''
    const W = 240, H = 60, P = 10
    const temps = data.map(d => d.temp)
    const minT  = Math.min(...temps)
    const range = (Math.max(...temps) - minT) || 1
    return data.map((d, i) => {
      const x = P + (i * (W - P * 2)) / (data.length - 1)
      const y = H - P - ((d.temp - minT) * (H - P * 2)) / range
      return `${x},${y}`
    }).join(' ')
  }

  const sunPos     = getSunPosition()
  const chartPoints = getChartPoints()
  const aqiInfo    = getAqiText(weatherData?.current?.aqi)
  const joinDate   = user?.created_at ? new Date(user.created_at).toLocaleDateString(undefined, { year: 'numeric', month: 'long' }) : 'Unknown'

  // ─── Render ──────────────────────────────────────────────────────────────────
  return (
    <div className="home-container">
      <WeatherBackground condition={currentCondition} isNight={isNight} />

      {/* Navbar */}
      <nav className="home-navbar">
        <div className="logo-section">
          <div className="logo-dot"></div>
          <span>SecureWeatherPortal</span>
        </div>
        <div className="navbar-actions">
          <form onSubmit={handleSearchSubmit} style={{ display: 'flex', gap: '6px' }}>
            <div className="input-wrapper" style={{ width: '180px' }}>
              <Search className="input-icon" size={16} />
              <input
                type="text"
                className="input-field"
                style={{ padding: '8px 12px 8px 36px', borderRadius: '14px', fontSize: '13px' }}
                placeholder="Search city..."
                value={cityInput}
                onChange={(e) => setCityInput(e.target.value)}
              />
            </div>
            <button type="submit" className="btn btn-secondary" style={{ width: '36px', height: '36px', padding: '0', borderRadius: '14px', flexShrink: 0 }}>
              <Compass size={16} />
            </button>
          </form>
          <div className="user-badge"><ShieldCheck size={16} /><span>Secure</span></div>
        </div>
      </nav>

      {/* Main Grid */}
      <div className="dashboard-grid">

        {/* ── Left Column ─────────────────────────────────────────────────────── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>

          {/* Profile Card */}
          <div className="glass-card profile-card" style={{ gap: '16px' }}>
            <div className="avatar-wrapper" style={{ fontSize: '42px', background: 'linear-gradient(135deg, var(--accent), #3b82f6)' }}>
              {avatarEmoji}
            </div>
            <div>
              <div className="profile-email" style={{ fontSize: '18px', fontWeight: '700' }}>{displayName}</div>
              <div style={{ fontSize: '12px', opacity: 0.8, wordBreak: 'break-all', marginTop: '2px' }}>{user?.email}</div>
            </div>

            <div style={{ width: '100%', height: '1px', background: 'var(--border)' }} />

            <form onSubmit={handleUpdateProfile} className="settings-form">
              <div className="form-group" style={{ marginBottom: '0px' }}>
                <label className="form-label">Display Name</label>
                <input type="text" className="input-field" style={{ paddingLeft: '16px' }} value={displayName} onChange={(e) => setDisplayName(e.target.value)} required />
              </div>
              <div className="form-group" style={{ marginBottom: '0px' }}>
                <label className="form-label">Choose Character</label>
                <div className="avatar-selector">
                  {emojis.map((emoji) => (
                    <button key={emoji} type="button" className={`avatar-opt ${avatarEmoji === emoji ? 'active' : ''}`} onClick={() => setAvatarEmoji(emoji)}>{emoji}</button>
                  ))}
                </div>
              </div>
              <button type="submit" className="btn btn-primary" style={{ padding: '8px 16px', fontSize: '13px' }} disabled={updatingProfile}>
                {updatingProfile ? <span className="spinner" /> : <><Save size={15} /> Save Changes</>}
              </button>
              {profileSavedMsg && <div style={{ fontSize: '11px', color: 'var(--success)', textAlign: 'center' }}><CheckCircle2 size={12} style={{ display: 'inline' }} /> Profile saved!</div>}
            </form>

            <div style={{ width: '100%', height: '1px', background: 'var(--border)' }} />
            <button onClick={handleLogout} className="btn btn-danger"><LogOut size={18} /><span>Sign Out</span></button>
          </div>

          {/* Demo Weather Sandbox */}
          <div className="glass-card" style={{ padding: '24px', textAlign: 'left' }}>
            <h4 style={{ margin: '0 0 12px 0', fontSize: '14px', fontWeight: '700', color: 'var(--text-h)', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <RefreshCw size={15} /> Demo Weather Sandbox
            </h4>
            <p style={{ fontSize: '12px', margin: '0 0 14px 0', lineHeight: '1.4' }}>Override theme states to test animations:</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                {[['clear','☀️ Clear'],['clouds','☁️ Cloudy'],['rain','🌧️ Rainy'],['snow','❄️ Snowy']].map(([cond, label]) => (
                  <button key={cond} onClick={() => setDemoCondition(demoCondition === cond ? null : cond)}
                    className={`btn ${currentCondition === cond && demoCondition ? 'btn-primary' : 'btn-secondary'}`}
                    style={{ padding: '6px 10px', fontSize: '11px', flex: '1 1 45%' }}>
                    {label}
                  </button>
                ))}
              </div>
              <div style={{ display: 'flex', gap: '6px' }}>
                <button onClick={() => setDemoIsNight(demoIsNight === false ? null : false)} className={`btn ${demoIsNight === false ? 'btn-primary' : 'btn-secondary'}`} style={{ padding: '6px 10px', fontSize: '11px', flex: '1' }}>🌅 Day Mode</button>
                <button onClick={() => setDemoIsNight(demoIsNight === true  ? null : true)}  className={`btn ${demoIsNight === true  ? 'btn-primary' : 'btn-secondary'}`} style={{ padding: '6px 10px', fontSize: '11px', flex: '1' }}>🌌 Night Mode</button>
              </div>
              {(demoCondition || demoIsNight !== null) && (
                <button onClick={() => { setDemoCondition(null); setDemoIsNight(null) }}
                  style={{ background: 'none', border: 'none', color: 'var(--accent)', cursor: 'pointer', fontSize: '11px', textDecoration: 'underline', textAlign: 'center' }}>
                  Reset to Live Weather
                </button>
              )}
            </div>
          </div>
        </div>

        {/* ── Right Column ─────────────────────────────────────────────────────── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>

          {/* Main Weather Hero Card */}
          <div className="glass-card info-card" style={{ position: 'relative', overflow: 'hidden' }}>
            {weatherLoading ? (
              <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '140px', flexDirection: 'column', gap: '10px' }}>
                <span className="spinner spinner-dark" />
                <span style={{ fontSize: '12px' }}>Querying weather stations...</span>
              </div>
            ) : weatherError ? (
              <div style={{ color: 'var(--error)', padding: '20px 0', textAlign: 'center' }}>
                <p style={{ fontSize: '14px', fontWeight: '600' }}>{weatherError}</p>
                <button onClick={() => loadWeather('Saudi Arabia')} className="btn btn-secondary" style={{ marginTop: '12px', fontSize: '12px', padding: '6px 12px', width: 'auto' }}>
                  Reload Default Location
                </button>
              </div>
            ) : (
              <div>
                {/* Greeting header */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '12px' }}>
                  <div>
                    <h3 className="info-title" style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                      <Sparkles style={{ color: 'var(--accent)' }} size={22} />
                      {getGreeting()}, {displayName}!
                    </h3>
                    <p style={{ fontSize: '15px', color: 'var(--text-h)', fontWeight: '500' }}>
                      It's {currentDesc}, <strong style={{ color: 'var(--accent)' }}>{currentTemp}°C</strong> in <span style={{ textTransform: 'uppercase', color: 'var(--accent)' }}>{currentCityName}</span>.
                    </p>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div style={{ fontSize: '42px', fontWeight: '800', color: 'var(--text-h)' }}>{currentTemp}°C</div>
                    {getWeatherIcon(currentCondition, isNight, 38)}
                  </div>
                </div>

                {weatherData?.isDemo && (
                  <div style={{ fontSize: '11px', background: 'var(--accent-bg)', color: 'var(--accent)', border: '1px solid var(--accent-border)', padding: '6px 12px', borderRadius: '8px', marginTop: '12px' }}>
                    🔑 Demo Mode active — add <code>VITE_WEATHER_API_KEY</code> in <code>.env.local</code> for live data.
                  </div>
                )}

                {/* Stat chips */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '12px', marginTop: '20px' }}>
                  <div className="stat-item" style={{ display: 'flex', alignItems: 'center', gap: '10px', textAlign: 'left', padding: '10px 14px' }}>
                    <Wind size={18} style={{ color: 'var(--accent)' }} />
                    <div><div style={{ fontSize: '14px', fontWeight: '700', color: 'var(--text-h)' }}>{weatherData.current.wind} m/s</div><div style={{ fontSize: '10px', color: 'var(--text)' }}>Wind</div></div>
                  </div>
                  <div className="stat-item" style={{ display: 'flex', alignItems: 'center', gap: '10px', textAlign: 'left', padding: '10px 14px' }}>
                    <Droplets size={18} style={{ color: 'var(--accent)' }} />
                    <div><div style={{ fontSize: '14px', fontWeight: '700', color: 'var(--text-h)' }}>{weatherData.current.humidity}%</div><div style={{ fontSize: '10px', color: 'var(--text)' }}>Humidity</div></div>
                  </div>
                  <div className="stat-item" style={{ display: 'flex', alignItems: 'center', gap: '10px', textAlign: 'left', padding: '10px 14px' }}>
                    <span style={{ fontSize: '14px', fontWeight: '800', color: aqiInfo.color }}>AQI {weatherData.current.aqi}</span>
                    <div><div style={{ fontSize: '13px', fontWeight: '700', color: 'var(--text-h)' }}>{aqiInfo.text}</div><div style={{ fontSize: '10px', color: 'var(--text)' }}>Air Quality</div></div>
                  </div>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '16px' }}>
                  <button onClick={handleAddFavorite} className="btn btn-secondary" style={{ width: 'auto', padding: '6px 12px', fontSize: '12px', borderRadius: '8px' }}>
                    <Plus size={14} /> Save {currentCityName}
                  </button>
                  <span style={{ fontSize: '11px', opacity: 0.7 }}>Updated {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                </div>
              </div>
            )}
          </div>

          {/* Sun Arc + Advice / 24hr Chart + Notepad */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>

            {/* Solar Path & Suggestions */}
            <div className="glass-card" style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <h4 style={{ margin: '0', fontSize: '14px', fontWeight: '700', color: 'var(--text-h)' }}>Solar Path & Tips</h4>

              {/* Sunrise/Sunset SVG arc */}
              <div style={{ width: '100%', height: '64px', background: 'var(--code-bg)', borderRadius: '10px', padding: '5px', boxSizing: 'border-box' }}>
                <svg viewBox="0 0 100 50" style={{ width: '100%', height: '100%' }}>
                  <path d="M 15 45 Q 50 10 85 45" fill="none" stroke="var(--border)" strokeWidth="2" strokeDasharray="3,3" />
                  {sunPos
                    ? <circle cx={sunPos.x} cy={sunPos.y} r="4" fill="#f59e0b" filter="drop-shadow(0 0 3px rgba(245,158,11,0.8))" />
                    : <circle cx="50" cy="46" r="3.5" fill="#94a3b8" />
                  }
                  <text x="15" y="49" fontSize="5.5" fill="var(--text)" textAnchor="middle">🌅 {weatherData?.current?.sunrise || '05:30'}</text>
                  <text x="85" y="49" fontSize="5.5" fill="var(--text)" textAnchor="middle">🌇 {weatherData?.current?.sunset || '18:50'}</text>
                </svg>
              </div>

              <div style={{ fontSize: '12px', display: 'flex', flexDirection: 'column', gap: '8px', lineHeight: '1.4' }}>
                <div>
                  <strong style={{ display: 'block', fontSize: '10px', color: 'var(--text-h)', textTransform: 'uppercase', marginBottom: '2px' }}>Recommended Outfit</strong>
                  <span>{getOutfitSuggestion()}</span>
                </div>
                <div>
                  <strong style={{ display: 'block', fontSize: '10px', color: 'var(--text-h)', textTransform: 'uppercase', marginBottom: '2px' }}>Today's Vibe</strong>
                  <span>{getActivitySuggestion()}</span>
                </div>
              </div>
            </div>

            {/* 24-Hour Temp Trend + Quick Notepad */}
            <div className="glass-card" style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <h4 style={{ margin: '0', fontSize: '14px', fontWeight: '700', color: 'var(--text-h)', display: 'flex', justifyContent: 'space-between' }}>
                <span>24-Hour Trend</span>
                <span style={{ fontSize: '11px', fontWeight: '500', color: 'var(--accent)' }}>Forecast</span>
              </h4>

              {/* SVG Line Chart */}
              {chartPoints ? (
                <div style={{ width: '100%', height: '72px', background: 'var(--code-bg)', borderRadius: '10px', padding: '4px', boxSizing: 'border-box', overflow: 'hidden' }}>
                  <svg viewBox="0 0 240 60" style={{ width: '100%', height: '100%', overflow: 'visible' }}>
                    <polyline fill="none" stroke="var(--accent)" strokeWidth="2.5" points={chartPoints} />
                    {weatherData.hourly.map((item, idx) => {
                      const W = 240, H = 60, P = 10
                      const temps = weatherData.hourly.map(d => d.temp)
                      const minT  = Math.min(...temps)
                      const range = (Math.max(...temps) - minT) || 1
                      const x = P + (idx * (W - P * 2)) / (weatherData.hourly.length - 1)
                      const y = H - P - ((item.temp - minT) * (H - P * 2)) / range
                      return (
                        <g key={idx}>
                          <circle cx={x} cy={y} r="3" fill="var(--bg)" stroke="var(--accent)" strokeWidth="1.5" />
                          <text x={x} y={y - 5} fontSize="7" fill="var(--text-h)" textAnchor="middle" fontWeight="bold">{item.temp}°</text>
                          <text x={x} y="59"  fontSize="5.5" fill="var(--text)" textAnchor="middle">{item.time}</text>
                        </g>
                      )
                    })}
                  </svg>
                </div>
              ) : (
                <div style={{ height: '72px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', background: 'var(--code-bg)', borderRadius: '10px' }}>
                  Loading trend...
                </div>
              )}

              {/* Quick Notepad */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <label className="form-label" style={{ fontSize: '11px', textTransform: 'uppercase', marginBottom: 0 }}>Quick Note</label>
                  {noteSavedMsg && <span style={{ fontSize: '10px', color: 'var(--success)', fontWeight: '600' }}>✓ Saved</span>}
                </div>
                <div style={{ display: 'flex', gap: '6px' }}>
                  <input type="text" className="input-field" style={{ padding: '6px 12px', fontSize: '12px', borderRadius: '8px' }}
                    placeholder="Quick note..." value={personalNote} onChange={(e) => setPersonalNote(e.target.value)} />
                  <button onClick={handleSaveNote} className="btn btn-primary" style={{ width: 'auto', padding: '6px 12px', borderRadius: '8px', fontSize: '12px' }}>Save</button>
                </div>
              </div>
            </div>
          </div>

          {/* 5-Day Forecast Strip */}
          <div className="glass-card" style={{ padding: '20px', textAlign: 'left' }}>
            <h4 style={{ margin: '0 0 14px 0', fontSize: '14px', fontWeight: '700', color: 'var(--text-h)' }}>5-Day Forecast</h4>
            {weatherLoading ? (
              <div style={{ height: '40px', fontSize: '12px' }}>Loading forecast...</div>
            ) : (
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: '8px', overflowX: 'auto' }}>
                {weatherData?.forecast?.map((day, idx) => (
                  <div key={idx} className="stat-item" style={{ flex: '1', padding: '10px', minWidth: '70px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px' }}>
                    <span style={{ fontSize: '12px', fontWeight: '600', color: 'var(--text-h)' }}>{day.day}</span>
                    {getWeatherIcon(day.condition, false, 20)}
                    <span style={{ fontSize: '13px', fontWeight: '700', color: 'var(--text-h)' }}>{day.temp}°C</span>
                    <span style={{ fontSize: '9px', opacity: 0.8, textTransform: 'capitalize' }}>{day.condition}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Favorites Multi-City Comparison */}
          <div className="glass-card" style={{ padding: '20px', textAlign: 'left' }}>
            <h4 style={{ margin: '0 0 14px 0', fontSize: '14px', fontWeight: '700', color: 'var(--text-h)' }}>Multi-City Comparison</h4>
            {favoritesLoading ? (
              <div style={{ fontSize: '12px' }}>Updating favorite cities...</div>
            ) : favoritesData.length === 0 ? (
              <p style={{ fontSize: '12px', margin: 0, opacity: 0.8 }}>No cities saved. Click "Save {currentCityName}" above to start comparing.</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {favoritesData.map((fav, idx) => (
                  <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 14px', background: 'var(--code-bg)', borderRadius: '10px', border: '1px solid var(--border)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      {getWeatherIcon(fav.condition, false, 18)}
                      <span onClick={() => loadWeather(fav.name)} style={{ fontSize: '13px', fontWeight: '600', color: 'var(--text-h)', cursor: 'pointer', textDecoration: 'underline' }}>{fav.name}</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                      <span style={{ fontSize: '14px', fontWeight: '700', color: 'var(--text-h)' }}>{fav.temp}°C</span>
                      <button onClick={() => handleRemoveFavorite(fav.name)} style={{ background: 'none', border: 'none', color: 'var(--error)', cursor: 'pointer', padding: '2px' }}>
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Security Audit Logs */}
          <div className="glass-card" style={{ padding: '20px', textAlign: 'left' }}>
            <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <ShieldAlert size={16} style={{ color: 'var(--accent)' }} /> Security Audit Logs
            </label>
            <div style={{ maxHeight: '110px', overflowY: 'auto', marginTop: '6px' }}>
              {logs.map((log) => (
                <div key={log.id} className="log-item">
                  <span className="log-status">
                    <span style={{ width: '6px', height: '6px', borderRadius: '50%', flexShrink: 0, background: log.type === 'profile' ? '#3b82f6' : log.type === 'notepad' ? '#10b981' : 'var(--accent)' }} />
                    {log.action}
                  </span>
                  <span style={{ opacity: 0.7, fontSize: '11px' }}>{log.time}</span>
                </div>
              ))}
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '14px', fontSize: '11px', opacity: 0.8 }}>
              <span>ID: <code>{user?.id?.substring(0, 16)}…</code></span>
              <span>Since {joinDate}</span>
            </div>
          </div>

        </div>
      </div>
    </div>
  )
}
