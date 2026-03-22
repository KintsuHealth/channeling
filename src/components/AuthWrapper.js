import { useState } from 'react';
import { useAuth } from '@/lib/useAuth';

export function AuthWrapper({ children }) {
  const { user, loading, signIn, error } = useAuth();
  const [email, setEmail] = useState('');
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [localError, setLocalError] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email.trim()) return;

    setSending(true);
    setLocalError(null);

    const { error: signInError } = await signIn(email.trim());

    setSending(false);
    if (signInError) {
      setLocalError(signInError.message);
    } else {
      setSent(true);
    }
  };

  if (loading) {
    return (
      <div style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'var(--bg)',
      }}>
        <div style={{
          width: 32,
          height: 32,
          border: '3px solid var(--border)',
          borderTopColor: 'var(--accent)',
          borderRadius: '50%',
          animation: 'spin 0.8s linear infinite',
        }} />
      </div>
    );
  }

  if (user) {
    return children;
  }

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: 20,
      background: 'var(--bg)',
    }}>
      <div style={{
        width: '100%',
        maxWidth: 360,
        padding: 32,
        background: 'var(--card)',
        borderRadius: 16,
        boxShadow: '0 4px 24px rgba(92,45,14,0.08)',
      }}>
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <span style={{ fontSize: 40 }}>&#9749;</span>
          <h1 style={{
            fontFamily: "'Playfair Display', Georgia, serif",
            fontSize: 26,
            fontWeight: 700,
            color: 'var(--accent-dark)',
            margin: '8px 0 4px',
          }}>
            BeanDex
          </h1>
          <p style={{
            fontSize: 13,
            color: 'var(--muted)',
            margin: 0,
          }}>
            Your coffee inventory, anywhere
          </p>
        </div>

        {sent ? (
          <div style={{ textAlign: 'center' }}>
            <div style={{
              padding: 16,
              background: '#E8F5E9',
              borderRadius: 10,
              marginBottom: 16,
            }}>
              <div style={{ fontSize: 24, marginBottom: 8 }}>&#9993;</div>
              <div style={{ fontSize: 14, fontWeight: 600, color: '#2E7D32', marginBottom: 4 }}>
                Check your email
              </div>
              <div style={{ fontSize: 12, color: '#4CAF50' }}>
                Click the magic link we sent to <strong>{email}</strong>
              </div>
            </div>
            <button
              onClick={() => { setSent(false); setEmail(''); }}
              style={{
                padding: '8px 16px',
                background: 'none',
                border: '1px solid var(--border)',
                borderRadius: 6,
                fontSize: 12,
                color: 'var(--muted)',
                cursor: 'pointer',
              }}
            >
              Use different email
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit}>
            <div style={{ marginBottom: 16 }}>
              <label style={{
                display: 'block',
                fontSize: 11,
                fontWeight: 600,
                color: 'var(--muted)',
                marginBottom: 6,
                textTransform: 'uppercase',
                letterSpacing: '0.5px',
              }}>
                Email
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                autoFocus
                style={{
                  width: '100%',
                  padding: '12px 14px',
                  border: '1.5px solid var(--border)',
                  borderRadius: 8,
                  fontSize: 14,
                  background: '#fff',
                  color: 'var(--text)',
                  boxSizing: 'border-box',
                }}
              />
            </div>

            {(localError || error) && (
              <div style={{
                padding: '10px 12px',
                background: '#FDF0E8',
                border: '1px solid var(--error)',
                borderRadius: 6,
                fontSize: 12,
                color: 'var(--error)',
                marginBottom: 16,
              }}>
                {localError || error}
              </div>
            )}

            <button
              type="submit"
              disabled={sending || !email.trim()}
              style={{
                width: '100%',
                padding: '12px 0',
                background: email.trim() ? 'var(--accent-dark)' : 'var(--border)',
                color: '#fff',
                border: 'none',
                borderRadius: 8,
                fontSize: 14,
                fontWeight: 600,
                cursor: email.trim() ? 'pointer' : 'default',
                opacity: sending ? 0.7 : 1,
              }}
            >
              {sending ? 'Sending...' : 'Send Magic Link'}
            </button>

            <p style={{
              fontSize: 11,
              color: 'var(--muted)',
              textAlign: 'center',
              marginTop: 16,
              lineHeight: 1.5,
            }}>
              No password needed. We'll send you a link to sign in.
            </p>
          </form>
        )}
      </div>
    </div>
  );
}
