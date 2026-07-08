/**
 * App.jsx — Weather-Aware Auth Dashboard
 * -----------------------------------------------------------------------
 * Single-file app: Supabase auth + Postgres, OpenWeatherMap live data,
 * a dashboard whose whole look (gradient, animation, copy) reacts to the
 * real current weather + local time, a map view, and a trends view.
 *
 * REQUIRED PACKAGES (run in your auth-app repo):
 *   npm install @supabase/supabase-js react-router-dom leaflet react-leaflet
 *
 * WIRE IT UP:
 *   Replace the contents of src/App.jsx with this file, and make sure
 *   src/main.jsx just renders <App /> (no extra router — this file owns
 *   its own BrowserRouter).
 *
 * ENV VARS (recommended — create a .env file, Vite auto-loads it):
 *   VITE_SUPABASE_URL=https://eqbsbiswswoehjceattw.supabase.co
 *   VITE_SUPABASE_ANON_KEY=<your anon key>
 *   VITE_WEATHER_API_KEY=<your openweathermap key>
 * The values you gave me are used as fallbacks below so this runs even
 * without a .env, but env vars are the safer place for them long-term.
 *
 * SUPABASE SQL SETUP (run once in the Supabase SQL editor):
 *   create table public.favorites (
 *     id uuid primary key default gen_random_uuid(),
 *     user_id uuid references auth.users(id) on delete cascade not null,
 *     city text not null,
 *     lat double precision,
 *     lon double precision,
 *     created_at timestamptz default now()
 *   );
 *   alter table public.favorites enable row level security;
 *   create policy "own favorites" on public.favorites
 *     for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
 *
 *   create table public.profiles (
 *     user_id uuid primary key references auth.users(id) on delete cascade,
 *     last_city text,
 *     updated_at timestamptz default now()
 *   );
 *   alter table public.profiles enable row level security;
 *   create policy "own profile" on public.profiles
 *     for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
 *
 * NOTE ON "HISTORICAL" DATA:
 *   OpenWeatherMap's true historical endpoint needs a paid subscription.
 *   On the free tier, the "trend" chart below uses the next-24-hour
 *   forecast curve (3-hour steps) instead — labeled honestly as
 *   "Next 24 Hours," not "history."
 * -----------------------------------------------------------------------
 */

import React, {
  useState, useEffect, useCallback, useMemo, useRef,
  createContext, useContext,
} from 'react';
import {
  BrowserRouter, Routes, Route, Navigate, Link, useNavigate, useLocation,
} from 'react-router-dom';
import { createClient } from '@supabase/supabase-js';
import { MapContainer, TileLayer, Marker, Popup, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

/* ------------------------------------------------------------------ */
/* CONFIG                                                              */
/* ------------------------------------------------------------------ */

const SUPABASE_URL =
  import.meta.env?.VITE_SUPABASE_URL ||
  'https://eqbsbiswswoehjceattw.supabase.co';
const SUPABASE_ANON_KEY =
  import.meta.env?.VITE_SUPABASE_ANON_KEY ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVxYnNiaXN3c3dvZWhqY2VhdHR3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODMyMjkyNzcsImV4cCI6MjA5ODgwNTI3N30.lFaMAvUjGcCaABL2He9cq51h3ADuF1T3mrnROGFR2TY';
const WEATHER_API_KEY =
  import.meta.env?.VITE_WEATHER_API_KEY || 'a52705dabb14777fd1065beb611841ac';

const WEATHER_BASE = 'https://api.openweathermap.org/data/2.5';
const DEFAULT_CITY = 'Khobar,SA';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Fix default leaflet marker icons (otherwise they render broken in bundlers)
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

/* ------------------------------------------------------------------ */
/* THEME                                                               */
/* ------------------------------------------------------------------ */

const THEMES = {
  sunny: {
    key: 'sunny', label: 'Sunny',
    gradient: 'linear-gradient(160deg,#FFE9A8 0%,#FFC15E 45%,#FF8A3D 100%)',
    text: '#4A2A00', accent: '#FF7E33', card: 'rgba(255,255,255,0.45)',
  },
  cloudy: {
    key: 'cloudy', label: 'Cloudy',
    gradient: 'linear-gradient(160deg,#DCE4EE 0%,#A9B7C9 55%,#77879C 100%)',
    text: '#1F2A38', accent: '#5B6B80', card: 'rgba(255,255,255,0.35)',
  },
  rain: {
    key: 'rain', label: 'Rainy',
    gradient: 'linear-gradient(160deg,#6C8CAA 0%,#44607C 55%,#26374A 100%)',
    text: '#F1F5F9', accent: '#8FB8E0', card: 'rgba(255,255,255,0.12)',
  },
  storm: {
    key: 'storm', label: 'Storm',
    gradient: 'linear-gradient(160deg,#4A4A5E 0%,#2A2A38 60%,#141418 100%)',
    text: '#FFE1B3', accent: '#FF6B6B', card: 'rgba(255,255,255,0.10)',
  },
  snow: {
    key: 'snow', label: 'Snow',
    gradient: 'linear-gradient(160deg,#F6FBFF 0%,#DFF0F9 55%,#C3E3F2 100%)',
    text: '#1F3A4D', accent: '#5FA8CC', card: 'rgba(255,255,255,0.55)',
  },
  night: {
    key: 'night', label: 'Night',
    gradient: 'linear-gradient(160deg,#463A6B 0%,#2A2148 55%,#120C24 100%)',
    text: '#EDE6FF', accent: '#B79CED', card: 'rgba(255,255,255,0.10)',
  },
};

function getTheme(weatherMain, isNight) {
  if (isNight) return THEMES.night;
  const key = (weatherMain || '').toLowerCase();
  if (key.includes('thunderstorm')) return THEMES.storm;
  if (key.includes('rain') || key.includes('drizzle')) return THEMES.rain;
  if (key.includes('snow')) return THEMES.snow;
  if (key.includes('clear')) return THEMES.sunny;
  return THEMES.cloudy;
}

/* ------------------------------------------------------------------ */
/* WEATHER API HELPERS                                                 */
/* ------------------------------------------------------------------ */

async function fetchCurrentWeather(city) {
  const res = await fetch(
    `${WEATHER_BASE}/weather?q=${encodeURIComponent(city)}&units=metric&appid=${WEATHER_API_KEY}`
  );
  if (!res.ok) throw new Error('City not found');
  return res.json();
}

async function fetchCurrentWeatherByCoords(lat, lon) {
  const res = await fetch(
    `${WEATHER_BASE}/weather?lat=${lat}&lon=${lon}&units=metric&appid=${WEATHER_API_KEY}`
  );
  if (!res.ok) throw new Error('Weather unavailable for this location');
  return res.json();
}

async function fetchForecast(city) {
  const res = await fetch(
    `${WEATHER_BASE}/forecast?q=${encodeURIComponent(city)}&units=metric&appid=${WEATHER_API_KEY}`
  );
  if (!res.ok) throw new Error('Forecast unavailable');
  return res.json();
}

async function fetchAirQuality(lat, lon) {
  const res = await fetch(
    `${WEATHER_BASE}/air_pollution?lat=${lat}&lon=${lon}&appid=${WEATHER_API_KEY}`
  );
  if (!res.ok) throw new Error('Air quality unavailable');
  return res.json();
}

function buildDailyForecast(forecastList) {
  const byDay = {};
  (forecastList || []).forEach((item) => {
    const date = item.dt_txt.split(' ')[0];
    if (!byDay[date]) byDay[date] = [];
    byDay[date].push(item);
  });
  return Object.entries(byDay)
    .slice(0, 5)
    .map(([date, items]) => {
      const midday =
        items.find((i) => i.dt_txt.includes('12:00:00')) ||
        items[Math.floor(items.length / 2)];
      return {
        date,
        temp: Math.round(midday.main.temp),
        main: midday.weather[0].main,
        icon: midday.weather[0].icon,
      };
    });
}

function buildTrendPoints(forecastList) {
  return (forecastList || []).slice(0, 8).map((item) => ({
    label: item.dt_txt.slice(11, 16),
    temp: Math.round(item.main.temp * 10) / 10,
  }));
}

const AQI_LABELS = ['', 'Good', 'Fair', 'Moderate', 'Poor', 'Very Poor'];

function getOutfitSuggestion(temp, main, wind) {
  const tips = [];
  if (temp < 10) tips.push('It is cold — wear a heavy coat.');
  else if (temp < 18) tips.push('Bring a jacket, it is a bit chilly.');
  else if (temp > 32) tips.push('Light, breathable clothing recommended — it is hot.');
  if (/rain|drizzle|thunderstorm/i.test(main)) tips.push('Bring an umbrella.');
  if (/snow/i.test(main)) tips.push('Wear boots, snow is falling.');
  if (wind > 10) tips.push('Windy out there — a windbreaker helps.');
  return tips.length ? tips : ['Dress comfortably, conditions are mild.'];
}

function getMoodSuggestion(temp, main) {
  if (/clear/i.test(main) && temp >= 18 && temp <= 32) return 'Great day for a walk outside.';
  if (/rain|drizzle|thunderstorm/i.test(main)) return 'Good day to stay in and read.';
  if (/snow/i.test(main)) return 'Cozy day — maybe something warm to drink.';
  if (temp > 38) return 'Stay indoors during peak heat and hydrate well.';
  return 'A calm day, good for whatever you have planned.';
}

function getAlert(weather) {
  if (!weather) return null;
  const temp = weather.main.temp;
  const main = weather.weather[0].main;
  if (temp >= 42) return { level: 'Heat warning', detail: 'Extreme heat — limit outdoor exposure.' };
  if (main === 'Thunderstorm') return { level: 'Storm alert', detail: 'Thunderstorms nearby — stay indoors if possible.' };
  if (temp <= 0) return { level: 'Freeze warning', detail: 'Below freezing — watch out for ice.' };
  return null;
}

function getGreeting(localHour) {
  if (localHour < 12) return 'Good morning';
  if (localHour < 18) return 'Good afternoon';
  return 'Good evening';
}

/* ------------------------------------------------------------------ */
/* AUTH CONTEXT                                                        */
/* ------------------------------------------------------------------ */

const AuthContext = createContext(null);
function useAuth() {
  return useContext(AuthContext);
}

function AuthProvider({ children }) {
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoading(false);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, sess) => {
      setSession(sess);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  return (
    <AuthContext.Provider value={{ session, loading }}>
      {children}
    </AuthContext.Provider>
  );
}

function ProtectedRoute({ children }) {
  const { session, loading } = useAuth();
  if (loading) return <CenteredMessage text="Loading..." />;
  if (!session) return <Navigate to="/login" replace />;
  return children;
}

/* ------------------------------------------------------------------ */
/* WEATHER CONTEXT (shared across Dashboard / Maps / Trends)           */
/* ------------------------------------------------------------------ */

const WeatherContext = createContext(null);
function useWeather() {
  return useContext(WeatherContext);
}

function WeatherProvider({ children }) {
  const { session } = useAuth();
  const userId = session?.user?.id;

  const [city, setCity] = useState(DEFAULT_CITY);
  const [weather, setWeather] = useState(null);
  const [forecast, setForecast] = useState(null);
  const [aqi, setAqi] = useState(null);
  const [favorites, setFavorites] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Load last searched city + favorites once we know who is logged in
  useEffect(() => {
    if (!userId) return;
    (async () => {
      try {
        const { data: profile } = await supabase
          .from('profiles')
          .select('last_city')
          .eq('user_id', userId)
          .maybeSingle();
        if (profile?.last_city) setCity(profile.last_city);
      } catch (e) {
        // profile row may not exist yet — that is fine
      }
      try {
        const { data: favs, error: favErr } = await supabase
          .from('favorites')
          .select('*')
          .eq('user_id', userId)
          .order('created_at', { ascending: true });
        if (favErr) throw favErr;
        setFavorites(favs || []);
      } catch (e) {
        console.error('Could not load favorites', e.message);
      }
    })();
  }, [userId]);

  const refresh = useCallback(async (targetCity) => {
    const cityToLoad = targetCity || city;
    setLoading(true);
    setError('');
    try {
      const w = await fetchCurrentWeather(cityToLoad);
      const f = await fetchForecast(cityToLoad);
      const a = await fetchAirQuality(w.coord.lat, w.coord.lon);
      setWeather(w);
      setForecast(f);
      setAqi(a);
      setCity(cityToLoad);
      if (userId) {
        supabase
          .from('profiles')
          .upsert({ user_id: userId, last_city: cityToLoad, updated_at: new Date().toISOString() })
          .then(({ error: upErr }) => {
            if (upErr) console.error('Could not save last city', upErr.message);
          });
      }
    } catch (e) {
      setError(e.message || 'Could not load weather for that city.');
    } finally {
      setLoading(false);
    }
  }, [city, userId]);

  useEffect(() => {
    if (userId) refresh(city);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  const addFavorite = useCallback(async () => {
    if (!userId || !weather) return;
    const { data, error: insErr } = await supabase
      .from('favorites')
      .insert({
        user_id: userId,
        city: weather.name,
        lat: weather.coord.lat,
        lon: weather.coord.lon,
      })
      .select()
      .single();
    if (insErr) {
      console.error(insErr.message);
      return;
    }
    setFavorites((prev) => [...prev, data]);
  }, [userId, weather]);

  const removeFavorite = useCallback(async (id) => {
    const { error: delErr } = await supabase.from('favorites').delete().eq('id', id);
    if (delErr) {
      console.error(delErr.message);
      return;
    }
    setFavorites((prev) => prev.filter((f) => f.id !== id));
  }, []);

  const isNight = useMemo(() => {
    if (!weather) return false;
    return weather.dt < weather.sys.sunrise || weather.dt > weather.sys.sunset;
  }, [weather]);

  const theme = useMemo(
    () => getTheme(weather?.weather?.[0]?.main, isNight),
    [weather, isNight]
  );

  const value = {
    city, setCity, weather, forecast, aqi, favorites, loading, error,
    refresh, addFavorite, removeFavorite, isNight, theme,
  };

  return <WeatherContext.Provider value={value}>{children}</WeatherContext.Provider>;
}

/* ------------------------------------------------------------------ */
/* GLOBAL STYLES (fonts + keyframes, injected once)                    */
/* ------------------------------------------------------------------ */

function GlobalStyles() {
  return (
    <style>{`
      @import url('https://fonts.googleapis.com/css2?family=Quicksand:wght@500;600;700&family=Inter:wght@400;500;600&display=swap');

      * { box-sizing: border-box; }
      html, body, #root { height: 100%; margin: 0; }
      body { font-family: 'Inter', system-ui, sans-serif; }
      h1, h2, h3, .display { font-family: 'Quicksand', system-ui, sans-serif; }

      @keyframes wa-fall {
        from { transform: translateY(-10vh); }
        to { transform: translateY(110vh); }
      }
      @keyframes wa-drift {
        from { transform: translateX(-10vw); }
        to { transform: translateX(110vw); }
      }
      @keyframes wa-twinkle {
        0%, 100% { opacity: 0.25; }
        50% { opacity: 0.9; }
      }
      @media (prefers-reduced-motion: reduce) {
        .wa-anim { animation: none !important; }
      }
    `}</style>
  );
}

/* ------------------------------------------------------------------ */
/* ANIMATED BACKGROUND                                                 */
/* ------------------------------------------------------------------ */

function AnimatedBackground({ themeKey }) {
  const items = useMemo(() => {
    const count = themeKey === 'rain' ? 40 : themeKey === 'snow' ? 30 : themeKey === 'storm' ? 50 : 10;
    return Array.from({ length: count }, (_, i) => ({
      id: i,
      left: Math.random() * 100,
      delay: Math.random() * 6,
      duration: 3 + Math.random() * 4,
      size: 4 + Math.random() * 10,
    }));
  }, [themeKey]);

  return (
    <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', pointerEvents: 'none', zIndex: 0 }}>
      {(themeKey === 'rain' || themeKey === 'storm') &&
        items.map((it) => (
          <div
            key={it.id}
            className="wa-anim"
            style={{
              position: 'absolute', left: `${it.left}%`, top: 0,
              width: 2, height: 16, borderRadius: 2,
              background: 'rgba(255,255,255,0.55)',
              animation: `wa-fall ${it.duration}s linear ${it.delay}s infinite`,
            }}
          />
        ))}
      {themeKey === 'snow' &&
        items.map((it) => (
          <div
            key={it.id}
            className="wa-anim"
            style={{
              position: 'absolute', left: `${it.left}%`, top: 0,
              width: it.size, height: it.size, borderRadius: '50%',
              background: 'rgba(255,255,255,0.85)',
              animation: `wa-fall ${it.duration + 4}s linear ${it.delay}s infinite`,
            }}
          />
        ))}
      {themeKey === 'sunny' &&
        items.slice(0, 4).map((it) => (
          <div
            key={it.id}
            className="wa-anim"
            style={{
              position: 'absolute', top: `${10 + it.id * 8}%`, left: 0,
              width: 90, height: 34, borderRadius: 20,
              background: 'rgba(255,255,255,0.35)',
              animation: `wa-drift ${30 + it.id * 6}s linear ${it.delay}s infinite`,
            }}
          />
        ))}
      {themeKey === 'night' &&
        items.map((it) => (
          <div
            key={it.id}
            className="wa-anim"
            style={{
              position: 'absolute', left: `${it.left}%`, top: `${(it.id * 7) % 90}%`,
              width: 2, height: 2, borderRadius: '50%', background: '#fff',
              animation: `wa-twinkle ${2 + it.delay}s ease-in-out infinite`,
            }}
          />
        ))}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* SMALL VISUAL WIDGETS                                                */
/* ------------------------------------------------------------------ */

function TrendChart({ points, accent, textColor }) {
  if (!points || !points.length) return null;
  const w = 320, h = 110, pad = 14;
  const temps = points.map((p) => p.temp);
  const min = Math.min(...temps), max = Math.max(...temps);
  const range = max - min || 1;
  const coords = points.map((p, i) => {
    const x = pad + (i / (points.length - 1 || 1)) * (w - pad * 2);
    const y = h - pad - ((p.temp - min) / range) * (h - pad * 2);
    return { x, y };
  });
  const line = coords.map((c) => `${c.x},${c.y}`).join(' ');
  return (
    <svg viewBox={`0 0 ${w} ${h}`} style={{ width: '100%', height: 110 }}>
      <polyline points={line} fill="none" stroke={accent} strokeWidth="2.5" />
      {coords.map((c, i) => (
        <circle key={i} cx={c.x} cy={c.y} r="3" fill={accent} />
      ))}
      {points.map((p, i) => (
        <text key={i} x={coords[i].x} y={h - 1} fontSize="9" textAnchor="middle" fill={textColor} opacity="0.7">
          {p.label}
        </text>
      ))}
    </svg>
  );
}

function SunArc({ dt, sunrise, sunset, accent }) {
  const total = sunset - sunrise;
  const progress = total > 0 ? Math.min(1, Math.max(0, (dt - sunrise) / total)) : 0;
  const angle = Math.PI * (1 - progress);
  const cx = 100, cy = 90, r = 78;
  const x = cx + r * Math.cos(angle);
  const y = cy - r * Math.sin(angle);
  return (
    <svg viewBox="0 0 200 100" style={{ width: '100%', maxWidth: 220 }}>
      <path d="M18,90 A82,82 0 0,1 182,90" fill="none" stroke="rgba(255,255,255,0.4)" strokeWidth="2" />
      <circle cx={x} cy={y} r="8" fill={accent} />
    </svg>
  );
}

function CenteredMessage({ text }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', fontFamily: 'sans-serif' }}>
      {text}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* AUTH PAGE (login + signup toggle)                                   */
/* ------------------------------------------------------------------ */

function AuthPage() {
  const [mode, setMode] = useState('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { session } = useAuth();

  useEffect(() => {
    if (session) navigate('/', { replace: true });
  }, [session, navigate]);

  async function handleSubmit(e) {
    e.preventDefault();
    setError(''); setInfo(''); setLoading(true);
    try {
      if (mode === 'signup') {
        const { error: signErr } = await supabase.auth.signUp({ email, password });
        if (signErr) throw signErr;
        setInfo('Account created. Check your email to confirm, then log in.');
        setMode('login');
      } else {
        const { error: signErr } = await supabase.auth.signInWithPassword({ email, password });
        if (signErr) throw signErr;
        navigate('/', { replace: true });
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: THEMES.sunny.gradient, padding: 20,
    }}>
      <form onSubmit={handleSubmit} style={{
        width: 360, maxWidth: '100%', background: 'rgba(255,255,255,0.85)',
        borderRadius: 20, padding: 32, boxShadow: '0 20px 60px rgba(0,0,0,0.15)',
      }}>
        <h1 className="display" style={{ margin: '0 0 4px', fontSize: 26 }}>
          {mode === 'login' ? 'Welcome back' : 'Create your account'}
        </h1>
        <p style={{ margin: '0 0 20px', color: '#6b5636', fontSize: 14 }}>
          Your weather-aware dashboard is one step away.
        </p>

        <label style={{ fontSize: 13, fontWeight: 600 }}>Email</label>
        <input
          type="email" required value={email} onChange={(e) => setEmail(e.target.value)}
          style={inputStyle}
        />
        <label style={{ fontSize: 13, fontWeight: 600 }}>Password</label>
        <input
          type="password" required minLength={6} value={password}
          onChange={(e) => setPassword(e.target.value)} style={inputStyle}
        />

        {error && <p style={{ color: '#B3261E', fontSize: 13 }}>{error}</p>}
        {info && <p style={{ color: '#1B5E20', fontSize: 13 }}>{info}</p>}

        <button type="submit" disabled={loading} style={buttonStyle}>
          {loading ? 'Please wait...' : mode === 'login' ? 'Log in' : 'Sign up'}
        </button>

        <p style={{ textAlign: 'center', fontSize: 13, marginTop: 16 }}>
          {mode === 'login' ? 'No account yet?' : 'Already have an account?'}{' '}
          <button
            type="button"
            onClick={() => { setMode(mode === 'login' ? 'signup' : 'login'); setError(''); setInfo(''); }}
            style={{ background: 'none', border: 'none', color: '#FF7E33', fontWeight: 600, cursor: 'pointer' }}
          >
            {mode === 'login' ? 'Sign up' : 'Log in'}
          </button>
        </p>
      </form>
    </div>
  );
}

const inputStyle = {
  width: '100%', padding: '10px 12px', margin: '6px 0 14px', borderRadius: 10,
  border: '1px solid #E0D3B8', fontSize: 14,
};
const buttonStyle = {
  width: '100%', padding: '12px', borderRadius: 10, border: 'none',
  background: '#FF7E33', color: '#fff', fontWeight: 700, fontSize: 15, cursor: 'pointer',
};

/* ------------------------------------------------------------------ */
/* LAYOUT + NAV                                                        */
/* ------------------------------------------------------------------ */

function Layout({ children }) {
  const { theme, weather } = useWeather();
  const location = useLocation();
  const navigate = useNavigate();

  async function handleLogout() {
    await supabase.auth.signOut();
    navigate('/login');
  }

  const navLinkStyle = (path) => ({
    padding: '8px 14px', borderRadius: 999, textDecoration: 'none',
    color: theme.text, fontWeight: 600, fontSize: 14,
    background: location.pathname === path ? 'rgba(255,255,255,0.35)' : 'transparent',
  });

  return (
    <div style={{
      minHeight: '100vh', position: 'relative', background: theme.gradient,
      color: theme.text, transition: 'background 0.8s ease',
    }}>
      <AnimatedBackground themeKey={theme.key} />
      <div style={{ position: 'relative', zIndex: 1 }}>
        <nav style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '14px 24px', flexWrap: 'wrap', gap: 10,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span className="display" style={{ fontSize: 20, fontWeight: 700 }}>
              {weather ? `${weather.name}` : 'Weather Dashboard'}
            </span>
          </div>
          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            <Link to="/" style={navLinkStyle('/')}>Dashboard</Link>
            <Link to="/maps" style={navLinkStyle('/maps')}>Maps</Link>
            <Link to="/trends" style={navLinkStyle('/trends')}>Trends</Link>
            <button
              onClick={handleLogout}
              style={{
                padding: '8px 14px', borderRadius: 999, border: 'none',
                background: 'rgba(0,0,0,0.15)', color: theme.text, fontWeight: 600,
                cursor: 'pointer', fontSize: 14,
              }}
            >
              Log out
            </button>
          </div>
        </nav>
        <main style={{ padding: '10px 24px 60px' }}>{children}</main>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* DASHBOARD PAGE                                                      */
/* ------------------------------------------------------------------ */

function Card({ children, theme }) {
  return (
    <div style={{
      background: theme.card, backdropFilter: 'blur(6px)', borderRadius: 18,
      padding: 20, marginBottom: 16,
    }}>
      {children}
    </div>
  );
}

function DashboardPage() {
  const {
    city, weather, forecast, aqi, loading, error, refresh,
    favorites, addFavorite, removeFavorite, isNight, theme,
  } = useWeather();
  const [search, setSearch] = useState('');

  const localHour = weather
    ? new Date((weather.dt + weather.timezone) * 1000).getUTCHours()
    : new Date().getHours();

  const alert = getAlert(weather);
  const daily = forecast ? buildDailyForecast(forecast.list) : [];
  const isFavorite = weather && favorites.some((f) => f.city === weather.name);

  function handleSearch(e) {
    e.preventDefault();
    if (search.trim()) refresh(search.trim());
    setSearch('');
  }

  if (loading && !weather) return <CenteredMessage text="Loading weather..." />;

  return (
    <div style={{ maxWidth: 900, margin: '0 auto' }}>
      <form onSubmit={handleSearch} style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        <input
          value={search} onChange={(e) => setSearch(e.target.value)}
          placeholder="Search a city (e.g. Dubai, AE)"
          style={{ flex: 1, padding: '10px 14px', borderRadius: 12, border: 'none', fontSize: 14 }}
        />
        <button type="submit" style={{ ...buttonStyle, width: 'auto', padding: '10px 18px' }}>
          Go
        </button>
      </form>

      {error && (
        <Card theme={theme}><p style={{ margin: 0 }}>{error}</p></Card>
      )}

      {weather && (
        <>
          {alert && (
            <div style={{
              background: 'rgba(255,80,80,0.85)', color: '#fff', padding: '10px 16px',
              borderRadius: 12, marginBottom: 16, fontWeight: 700,
            }}>
              {alert.level}: {alert.detail}
            </div>
          )}

          <Card theme={theme}>
            <h2 className="display" style={{ margin: '0 0 4px' }}>
              {getGreeting(localHour)}! It is {theme.label.toLowerCase()} and{' '}
              {Math.round(weather.main.temp)}°C in {weather.name}
              {weather.sys?.country ? `, ${weather.sys.country}` : ''} today.
            </h2>
            <p style={{ margin: '8px 0 0', opacity: 0.85 }}>
              Feels like {Math.round(weather.main.feels_like)}°C · {weather.weather[0].description}
            </p>
            <button
              onClick={addFavorite}
              disabled={isFavorite}
              style={{
                marginTop: 12, border: 'none', borderRadius: 999, padding: '8px 16px',
                background: theme.accent, color: '#fff', fontWeight: 600, cursor: isFavorite ? 'default' : 'pointer',
                opacity: isFavorite ? 0.6 : 1,
              }}
            >
              {isFavorite ? 'Saved to favorites' : '☆ Save as favorite'}
            </button>
          </Card>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16 }}>
            <Card theme={theme}>
              <h3 style={{ marginTop: 0 }}>Outfit</h3>
              <ul style={{ paddingLeft: 18, margin: 0 }}>
                {getOutfitSuggestion(weather.main.temp, weather.weather[0].main, weather.wind.speed).map((t, i) => (
                  <li key={i}>{t}</li>
                ))}
              </ul>
            </Card>

            <Card theme={theme}>
              <h3 style={{ marginTop: 0 }}>Mood for today</h3>
              <p style={{ margin: 0 }}>{getMoodSuggestion(weather.main.temp, weather.weather[0].main)}</p>
            </Card>

            <Card theme={theme}>
              <h3 style={{ marginTop: 0 }}>Air quality</h3>
              {aqi ? (
                <p style={{ margin: 0, fontSize: 22, fontWeight: 700 }}>
                  {AQI_LABELS[aqi.list[0].main.aqi]}
                </p>
              ) : <p>Unavailable</p>}
            </Card>

            <Card theme={theme}>
              <h3 style={{ marginTop: 0 }}>Sun position</h3>
              <SunArc dt={weather.dt} sunrise={weather.sys.sunrise} sunset={weather.sys.sunset} accent={theme.accent} />
            </Card>
          </div>

          <Card theme={theme}>
            <h3 style={{ marginTop: 0 }}>Next 5 days</h3>
            <div style={{ display: 'flex', gap: 12, overflowX: 'auto' }}>
              {daily.map((d) => (
                <div key={d.date} style={{ textAlign: 'center', minWidth: 70 }}>
                  <div style={{ fontSize: 12, opacity: 0.8 }}>
                    {new Date(d.date).toLocaleDateString(undefined, { weekday: 'short' })}
                  </div>
                  <img
                    src={`https://openweathermap.org/img/wn/${d.icon}.png`}
                    alt={d.main} width={40} height={40}
                  />
                  <div style={{ fontWeight: 700 }}>{d.temp}°</div>
                </div>
              ))}
            </div>
          </Card>

          {favorites.length > 0 && (
            <Card theme={theme}>
              <h3 style={{ marginTop: 0 }}>Favorite cities</h3>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {favorites.map((f) => (
                  <div key={f.id} style={{
                    display: 'flex', alignItems: 'center', gap: 6, background: 'rgba(255,255,255,0.3)',
                    borderRadius: 999, padding: '6px 10px',
                  }}>
                    <button
                      onClick={() => refresh(f.city)}
                      style={{ border: 'none', background: 'none', cursor: 'pointer', fontWeight: 600, color: theme.text }}
                    >
                      {f.city}
                    </button>
                    <button
                      onClick={() => removeFavorite(f.id)}
                      style={{ border: 'none', background: 'none', cursor: 'pointer', color: theme.text, opacity: 0.6 }}
                      aria-label={`Remove ${f.city}`}
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            </Card>
          )}
        </>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* MAPS PAGE                                                           */
/* ------------------------------------------------------------------ */

function ClickToAdd({ onPick }) {
  useMapEvents({
    click(e) {
      onPick(e.latlng.lat, e.latlng.lng);
    },
  });
  return null;
}

function MapsPage() {
  const { weather, favorites, addFavorite, removeFavorite, refresh, theme } = useWeather();
  const [pinWeather, setPinWeather] = useState(null);

  const center = weather ? [weather.coord.lat, weather.coord.lon] : [24.7136, 46.6753];

  async function handleMapClick(lat, lon) {
    try {
      const w = await fetchCurrentWeatherByCoords(lat, lon);
      setPinWeather(w);
    } catch (e) {
      console.error(e.message);
    }
  }

  return (
    <div style={{ maxWidth: 1000, margin: '0 auto' }}>
      <Card theme={theme}>
        <p style={{ margin: 0 }}>Click anywhere on the map to check that spot's weather. Use the markers below to jump to a saved city.</p>
      </Card>
      <div style={{ height: 480, borderRadius: 18, overflow: 'hidden' }}>
        <MapContainer center={center} zoom={5} style={{ height: '100%', width: '100%' }}>
          <TileLayer
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            attribution="&copy; OpenStreetMap contributors"
          />
          <ClickToAdd onPick={handleMapClick} />
          {weather && (
            <Marker position={[weather.coord.lat, weather.coord.lon]}>
              <Popup>
                {weather.name}: {Math.round(weather.main.temp)}°C, {weather.weather[0].description}
              </Popup>
            </Marker>
          )}
          {favorites.map((f) => (
            <Marker key={f.id} position={[f.lat, f.lon]} eventHandlers={{ click: () => refresh(f.city) }}>
              <Popup>
                {f.city}
                <br />
                <button onClick={() => removeFavorite(f.id)}>Remove favorite</button>
              </Popup>
            </Marker>
          ))}
          {pinWeather && (
            <Marker position={[pinWeather.coord.lat, pinWeather.coord.lon]}>
              <Popup>
                {pinWeather.name || 'Selected spot'}: {Math.round(pinWeather.main.temp)}°C,{' '}
                {pinWeather.weather[0].description}
                <br />
                <button onClick={() => refresh(pinWeather.name)}>View on dashboard</button>
              </Popup>
            </Marker>
          )}
        </MapContainer>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* TRENDS PAGE                                                        */
/* ------------------------------------------------------------------ */

function TrendsPage() {
  const { weather, forecast, theme } = useWeather();
  const [compareCity, setCompareCity] = useState('');
  const [compareData, setCompareData] = useState(null);
  const [compareError, setCompareError] = useState('');

  const points = forecast ? buildTrendPoints(forecast.list) : [];

  async function handleCompare(e) {
    e.preventDefault();
    setCompareError('');
    try {
      const w = await fetchCurrentWeather(compareCity);
      setCompareData(w);
    } catch (err) {
      setCompareError(err.message);
      setCompareData(null);
    }
  }

  return (
    <div style={{ maxWidth: 900, margin: '0 auto' }}>
      <Card theme={theme}>
        <h3 style={{ marginTop: 0 }}>Temperature — Next 24 Hours ({weather?.name})</h3>
        <TrendChart points={points} accent={theme.accent} textColor={theme.text} />
        <p style={{ fontSize: 12, opacity: 0.7, marginBottom: 0 }}>
          Note: OpenWeatherMap's free tier does not include true historical data, so this
          shows the upcoming 24-hour forecast curve instead of the past.
        </p>
      </Card>

      <Card theme={theme}>
        <h3 style={{ marginTop: 0 }}>Compare cities</h3>
        <form onSubmit={handleCompare} style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
          <input
            value={compareCity} onChange={(e) => setCompareCity(e.target.value)}
            placeholder="e.g. Dubai, AE"
            style={{ flex: 1, padding: '10px 14px', borderRadius: 12, border: 'none' }}
          />
          <button type="submit" style={{ ...buttonStyle, width: 'auto', padding: '10px 18px' }}>
            Compare
          </button>
        </form>
        {compareError && <p style={{ color: '#B3261E' }}>{compareError}</p>}
        <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
          {weather && (
            <div>
              <div style={{ fontWeight: 700 }}>{weather.name}</div>
              <div style={{ fontSize: 28 }}>{Math.round(weather.main.temp)}°C</div>
              <div style={{ fontSize: 13, opacity: 0.8 }}>{weather.weather[0].description}</div>
            </div>
          )}
          {compareData && (
            <div>
              <div style={{ fontWeight: 700 }}>{compareData.name}</div>
              <div style={{ fontSize: 28 }}>{Math.round(compareData.main.temp)}°C</div>
              <div style={{ fontSize: 13, opacity: 0.8 }}>{compareData.weather[0].description}</div>
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* ROOT APP                                                            */
/* ------------------------------------------------------------------ */

function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<AuthPage />} />
      <Route
        path="/"
        element={
          <ProtectedRoute>
            <WeatherProvider>
              <Layout><DashboardPage /></Layout>
            </WeatherProvider>
          </ProtectedRoute>
        }
      />
      <Route
        path="/maps"
        element={
          <ProtectedRoute>
            <WeatherProvider>
              <Layout><MapsPage /></Layout>
            </WeatherProvider>
          </ProtectedRoute>
        }
      />
      <Route
        path="/trends"
        element={
          <ProtectedRoute>
            <WeatherProvider>
              <Layout><TrendsPage /></Layout>
            </WeatherProvider>
          </ProtectedRoute>
        }
      />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <GlobalStyles />
      <BrowserRouter>
        <AppRoutes />
      </BrowserRouter>
    </AuthProvider>
  );
}
