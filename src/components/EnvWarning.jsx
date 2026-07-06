import { AlertCircle, Terminal, HelpCircle } from 'lucide-react'

export default function EnvWarning() {
  return (
    <div className="warning-container auth-container">
      <div className="glass-card">
        <div className="auth-header">
          <div className="alert alert-error" style={{ marginBottom: '24px' }}>
            <AlertCircle className="alert-icon" />
            <div>
              <strong>Configuration Required</strong>
              <div style={{ marginTop: '4px' }}>
                Supabase environment variables are missing or set to placeholder values.
              </div>
            </div>
          </div>
          <h2 className="auth-title">Supabase Setup</h2>
          <p className="auth-subtitle">Follow these steps to connect your local app to your Supabase project.</p>
        </div>

        <div className="form-group">
          <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Terminal size={16} /> 1. Configure `.env.local`
          </label>
          <p style={{ fontSize: '13px', margin: '4px 0 8px 0', lineHeight: '1.4' }}>
            Make sure you have a <code>.env.local</code> file in your project root with the following keys:
          </p>
          <pre className="code-block">
{`VITE_SUPABASE_URL=https://your-project-id.supabase.co
VITE_SUPABASE_ANON_KEY=your-actual-anon-key`}
          </pre>
        </div>

        <div className="form-group" style={{ marginTop: '24px' }}>
          <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <HelpCircle size={16} /> 2. Where to find these keys?
          </label>
          <ul style={{ fontSize: '13px', paddingLeft: '20px', margin: '8px 0', lineHeight: '1.6' }}>
            <li>Go to your <strong>Supabase Dashboard</strong>.</li>
            <li>Navigate to <strong>Project Settings &gt; API</strong>.</li>
            <li>Copy the <strong>Project URL</strong> and <strong>anon/public</strong> key.</li>
          </ul>
        </div>

        <div style={{ marginTop: '30px', textAlign: 'center', fontSize: '12px', opacity: 0.8, lineHeight: '1.4' }}>
          Once the file is saved, please <strong>restart your Vite development server</strong> to load the new environment variables.
        </div>
      </div>
    </div>
  )
}
