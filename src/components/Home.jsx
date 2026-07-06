import { useState } from 'react'
import { LogOut, Calendar, ShieldCheck, Save, FileText, CheckCircle2, ShieldAlert, Sparkles, Mail } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../supabaseClient'

export default function Home({ onViewChange }) {
  const { user, signOut } = useAuth()
  const [displayName, setDisplayName] = useState(() => user?.user_metadata?.display_name || user?.email?.split('@')[0] || '')
  const [avatarEmoji, setAvatarEmoji] = useState(() => user?.user_metadata?.avatar_emoji || '🚀')
  const [personalNote, setPersonalNote] = useState(() => {
    return user ? (localStorage.getItem(`secure_notes_${user.id}`) || '') : ''
  })
  
  const [noteSavedMsg, setNoteSavedMsg] = useState(false)
  const [profileSavedMsg, setProfileSavedMsg] = useState(false)
  const [updating, setUpdating] = useState(false)
  const [logs, setLogs] = useState(() => [
    { id: 1, action: 'Secure session initialized', time: 'Just now', type: 'system' },
    { id: 2, action: 'Authentication token verified', time: '1m ago', type: 'auth' },
    { id: 3, action: 'Successful portal login', time: '2m ago', type: 'auth' }
  ])

  const emojis = ['🚀', '💻', '🧠', '⚡', '🎨', '🦁']

  const handleLogout = async () => {
    try {
      await signOut()
      onViewChange('login')
    } catch (err) {
      console.error('Error signing out:', err)
    }
  }

  // Update profile in Supabase user metadata
  const handleUpdateProfile = async (e) => {
    e.preventDefault()
    setUpdating(true)
    setProfileSavedMsg(false)

    try {
      const { error } = await supabase.auth.updateUser({
        data: {
          display_name: displayName,
          avatar_emoji: avatarEmoji
        }
      })

      if (error) throw error

      setProfileSavedMsg(true)
      
      // Add log
      setLogs(prev => [
        {
          id: Date.now(),
          action: 'User profile metadata modified',
          time: 'Just now',
          type: 'profile'
        },
        ...prev
      ])

      setTimeout(() => setProfileSavedMsg(false), 2000)
    } catch (err) {
      console.error('Failed to update profile settings:', err)
    } finally {
      setUpdating(false)
    }
  }

  // Save personal note to localStorage
  const handleSaveNote = () => {
    localStorage.setItem(`secure_notes_${user.id}`, personalNote)
    setNoteSavedMsg(true)

    setLogs(prev => [
      {
        id: Date.now(),
        action: 'Encrypted notepad contents updated',
        time: 'Just now',
        type: 'notepad'
      },
      ...prev
    ])

    setTimeout(() => setNoteSavedMsg(false), 2000)
  }

  const joinDate = user?.created_at 
    ? new Date(user.created_at).toLocaleDateString(undefined, {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      })
    : 'Unknown'

  return (
    <div className="home-container">
      {/* Top Navbar */}
      <nav className="home-navbar">
        <div className="logo-section">
          <div className="logo-dot"></div>
          <span>SecurePortal</span>
        </div>
        <div className="navbar-actions">
          <div className="user-badge">
            <ShieldCheck size={16} />
            <span>Authenticated</span>
          </div>
        </div>
      </nav>

      {/* Main Dashboard Grid */}
      <div className="dashboard-grid">
        {/* Left column: Profile card */}
        <div className="glass-card profile-card" style={{ gap: '20px' }}>
          <div className="avatar-wrapper" style={{ fontSize: '42px', background: 'linear-gradient(135deg, var(--accent), #3b82f6)' }}>
            {avatarEmoji}
          </div>
          <div>
            <div className="profile-email" style={{ fontSize: '18px', fontWeight: '700' }}>
              {displayName || user?.email.split('@')[0]}
            </div>
            <div style={{ fontSize: '12px', opacity: 0.8, wordBreak: 'break-all', marginTop: '2px' }}>
              {user?.email}
            </div>
          </div>

          <div style={{ width: '100%', height: '1px', background: 'var(--border)' }}></div>

          {/* Interactive Profile Editor */}
          <form onSubmit={handleUpdateProfile} className="settings-form">
            <div className="form-group" style={{ marginBottom: '0px' }}>
              <label className="form-label">Display Name</label>
              <input
                type="text"
                className="input-field"
                style={{ paddingLeft: '16px' }}
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                required
                placeholder="Enter name"
                disabled={updating}
              />
            </div>

            <div className="form-group" style={{ marginBottom: '0px' }}>
              <label className="form-label">Choose Character</label>
              <div className="avatar-selector">
                {emojis.map((emoji) => (
                  <button
                    key={emoji}
                    type="button"
                    className={`avatar-opt ${avatarEmoji === emoji ? 'active' : ''}`}
                    onClick={() => setAvatarEmoji(emoji)}
                    disabled={updating}
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            </div>

            <button type="submit" className="btn btn-primary" style={{ padding: '8px 16px', fontSize: '13px' }} disabled={updating}>
              {updating ? <span className="spinner"></span> : <><Save size={15} /> Save Changes</>}
            </button>

            {profileSavedMsg && (
              <div style={{ fontSize: '12px', color: 'var(--success)', textAlign: 'center', fontWeight: '500', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}>
                <CheckCircle2 size={14} /> Profile saved!
              </div>
            )}
          </form>

          <div style={{ width: '100%', height: '1px', background: 'var(--border)' }}></div>

          <button onClick={handleLogout} className="btn btn-danger">
            <LogOut size={18} />
            <span>Sign Out</span>
          </button>
        </div>

        {/* Right column: Details and interactive notepad */}
        <div className="glass-card info-card" style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          <div>
            <h3 className="info-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Sparkles style={{ color: 'var(--accent)' }} size={22} />
              Welcome back, {displayName}!
            </h3>
            <p className="info-body">
              This environment provides direct integration with Supabase authentication. Below is your secure playground.
            </p>
          </div>

          {/* Interactive Feature: Secure Notes */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '0px' }}>
                <FileText size={16} style={{ color: 'var(--accent)' }} /> Personal Encrypted Notes
              </label>
              {noteSavedMsg && (
                <span style={{ fontSize: '12px', color: 'var(--success)', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <CheckCircle2 size={13} /> Notes stored!
                </span>
              )}
            </div>
            <textarea
              className="notepad-area"
              placeholder="Write personal drafts or secure logs here... (Persists uniquely to your user ID)"
              value={personalNote}
              onChange={(e) => setPersonalNote(e.target.value)}
            ></textarea>
            <button
              onClick={handleSaveNote}
              className="btn btn-secondary"
              style={{ width: 'auto', alignSelf: 'flex-end', padding: '8px 16px', fontSize: '13px' }}
            >
              Save Notes
            </button>
          </div>

          {/* Technical Info */}
          <div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
              <div style={{ display: 'flex', gap: '10px' }}>
                <Calendar size={18} style={{ color: 'var(--accent)', flexShrink: 0, marginTop: '2px' }} />
                <div>
                  <strong style={{ display: 'block', fontSize: '12px', color: 'var(--text-h)' }}>Created At</strong>
                  <span style={{ fontSize: '13px' }}>{joinDate}</span>
                </div>
              </div>
              <div style={{ display: 'flex', gap: '10px' }}>
                <Mail size={18} style={{ color: 'var(--accent)', flexShrink: 0, marginTop: '2px' }} />
                <div>
                  <strong style={{ display: 'block', fontSize: '12px', color: 'var(--text-h)' }}>Email Registered</strong>
                  <span style={{ fontSize: '13px', wordBreak: 'break-all' }}>{user?.email}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Real-time Audit logs */}
          <div>
            <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <ShieldAlert size={16} style={{ color: 'var(--accent)' }} /> Security Audit Logs
            </label>
            <div style={{ maxHeight: '130px', overflowY: 'auto', paddingRight: '4px', marginTop: '6px' }}>
              {logs.map((log) => (
                <div key={log.id} className="log-item">
                  <span className="log-status">
                    <span style={{
                      width: '6px',
                      height: '6px',
                      borderRadius: '50%',
                      background: log.type === 'profile' ? '#3b82f6' : log.type === 'notepad' ? '#10b981' : 'var(--accent)'
                    }}></span>
                    {log.action}
                  </span>
                  <span style={{ opacity: 0.7, fontSize: '11px' }}>{log.time}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
