import { useEffect, useState } from 'react'
import { AuthProvider, useAuth } from './context/AuthContext'
import { isConfigured } from './supabaseClient'
import Login from './components/Login'
import Signup from './components/Signup'
import Home from './components/Home'
import EnvWarning from './components/EnvWarning'
import { Sun, Moon } from 'lucide-react'

function AppContent({ theme, toggleTheme }) {
  const { user, loading } = useAuth()
  const [view, setView] = useState(() => {
    const hash = window.location.hash
    if (hash === '#signup') return 'signup'
    return 'login'
  })

  // Listen to hash changes in browser URL
  useEffect(() => {
    const handleHashChange = () => {
      const hash = window.location.hash
      if (hash === '#signup') {
        setView('signup')
      } else {
        setView('login')
      }
    }

    window.addEventListener('hashchange', handleHashChange)
    return () => window.removeEventListener('hashchange', handleHashChange)
  }, [])

  // Sync hash when view changes
  const handleViewChange = (newView) => {
    if (newView === 'signup') {
      window.location.hash = '#signup'
      setView('signup')
    } else if (newView === 'login') {
      window.location.hash = '#login'
      setView('login')
    }
  }

  if (loading) {
    return (
      <div className="loading-container">
        <span className="spinner spinner-dark" style={{ width: '40px', height: '40px', borderWidth: '3px' }}></span>
        <span className="loading-text">Securing session...</span>
      </div>
    )
  }

  // Route Guard: If user is logged in, show Home view regardless of internal route state
  if (user) {
    return <Home onViewChange={handleViewChange} theme={theme} toggleTheme={toggleTheme} />
  }

  if (view === 'signup') {
    return <Signup onViewChange={handleViewChange} />
  }

  return <Login onViewChange={handleViewChange} />
}

export default function App() {
  const [theme, setTheme] = useState(() => {
    const saved = localStorage.getItem('theme')
    if (saved) return saved
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
  })

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
    localStorage.setItem('theme', theme)
  }, [theme])

  const toggleTheme = () => {
    setTheme(prev => prev === 'dark' ? 'light' : 'dark')
  }

  // If Supabase environment variables are missing, display configuration helper page.
  if (!isConfigured) {
    return (
      <>
        <div style={{ position: 'fixed', top: '24px', right: '24px', zIndex: 1000 }}>
          <button onClick={toggleTheme} className="theme-toggle-btn" title="Toggle theme">
            {theme === 'dark' ? <Sun size={20} /> : <Moon size={20} />}
          </button>
        </div>
        <EnvWarning />
      </>
    )
  }

  return (
    <AuthProvider>
      <div style={{ position: 'fixed', top: '24px', right: '24px', zIndex: 1000 }}>
        <button onClick={toggleTheme} className="theme-toggle-btn" title="Toggle theme">
          {theme === 'dark' ? <Sun size={20} /> : <Moon size={20} />}
        </button>
      </div>
      <AppContent theme={theme} toggleTheme={toggleTheme} />
    </AuthProvider>
  )
}
