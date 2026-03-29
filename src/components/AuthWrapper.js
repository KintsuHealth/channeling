import { useState } from 'react';
import { useAuth } from '@/lib/useAuth';

export function AuthWrapper({ children }) {
  const { user, loading, signIn, signInWithPassword, signInWithGoogle, signUp, error } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [localError, setLocalError] = useState(null);
  const [mode, setMode] = useState('password'); // 'password' or 'magic'
  const [isSignUp, setIsSignUp] = useState(false);

  const handlePasswordSubmit = async (e) => {
    e.preventDefault();
    if (!email.trim() || !password.trim()) return;

    setSending(true);
    setLocalError(null);

    if (isSignUp) {
      const { error: signUpError } = await signUp(email.trim(), password);
      setSending(false);
      if (signUpError) {
        setLocalError(signUpError.message);
      } else {
        setSent(true);
      }
    } else {
      const { error: signInError } = await signInWithPassword(email.trim(), password);
      setSending(false);
      if (signInError) {
        if (signInError.message.includes('Invalid login')) {
          setLocalError('Invalid email or password');
        } else {
          setLocalError(signInError.message);
        }
      }
    }
  };

  const handleMagicSubmit = async (e) => {
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
          <h1 style={{
            fontFamily: "'Playfair Display', Georgia, serif",
            fontSize: 32,
            fontWeight: 800,
            color: 'var(--accent-dark)',
            margin: '0 0 4px',
          }}>
            Expertso
          </h1>
          <p style={{
            fontSize: 13,
            color: 'var(--muted)',
            margin: 0,
          }}>
            Your coffee inventory, anywhere
          </p>
        </div>

        {/* Google Sign In */}
        <button
          onClick={() => signInWithGoogle()}
          style={{
            width: '100%',
            padding: '12px 0',
            background: '#fff',
            color: '#333',
            border: '1.5px solid var(--border)',
            borderRadius: 8,
            fontSize: 14,
            fontWeight: 500,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 10,
            marginBottom: 20,
          }}
        >
          <svg width="18" height="18" viewBox="0 0 24 24">
            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
          </svg>
          Continue with Google
        </button>

        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          marginBottom: 20,
        }}>
          <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
          <span style={{ fontSize: 11, color: 'var(--muted)' }}>or</span>
          <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
        </div>

        {sent ? (
          <div style={{ textAlign: 'center' }}>
            <div style={{
              padding: 16,
              background: '#E8F5E9',
              borderRadius: 10,
              marginBottom: 16,
            }}>
              <div style={{ fontSize: 24, marginBottom: 8 }}>✓</div>
              <div style={{ fontSize: 14, fontWeight: 600, color: '#2E7D32', marginBottom: 4 }}>
                {isSignUp ? 'Check your email to confirm' : 'Check your email'}
              </div>
              <div style={{ fontSize: 12, color: '#4CAF50' }}>
                {isSignUp ? 'Click the link to activate your account' : `Click the magic link we sent to`} <strong>{email}</strong>
              </div>
            </div>
            <button
              onClick={() => { setSent(false); setEmail(''); setPassword(''); }}
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
              Go back
            </button>
          </div>
        ) : mode === 'password' ? (
          <form onSubmit={handlePasswordSubmit}>
            <div style={{ marginBottom: 12 }}>
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
                Password
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
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
              disabled={sending || !email.trim() || !password.trim()}
              style={{
                width: '100%',
                padding: '12px 0',
                background: (email.trim() && password.trim()) ? 'var(--accent-dark)' : 'var(--border)',
                color: '#fff',
                border: 'none',
                borderRadius: 8,
                fontSize: 14,
                fontWeight: 600,
                cursor: (email.trim() && password.trim()) ? 'pointer' : 'default',
                opacity: sending ? 0.7 : 1,
              }}
            >
              {sending ? 'Signing in...' : isSignUp ? 'Create Account' : 'Sign In'}
            </button>

            <div style={{ textAlign: 'center', marginTop: 16 }}>
              <button
                type="button"
                onClick={() => setIsSignUp(!isSignUp)}
                style={{
                  background: 'none',
                  border: 'none',
                  fontSize: 12,
                  color: 'var(--accent)',
                  cursor: 'pointer',
                  textDecoration: 'underline',
                }}
              >
                {isSignUp ? 'Already have an account? Sign in' : "Don't have an account? Sign up"}
              </button>
            </div>

            <div style={{
              textAlign: 'center',
              marginTop: 16,
              paddingTop: 16,
              borderTop: '1px solid var(--border)',
            }}>
              <button
                type="button"
                onClick={() => setMode('magic')}
                style={{
                  background: 'none',
                  border: 'none',
                  fontSize: 12,
                  color: 'var(--muted)',
                  cursor: 'pointer',
                }}
              >
                Use magic link instead
              </button>
            </div>
          </form>
        ) : (
          <form onSubmit={handleMagicSubmit}>
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
              marginTop: 12,
              marginBottom: 16,
              lineHeight: 1.5,
            }}>
              No password needed. We'll email you a link.
            </p>

            <div style={{
              textAlign: 'center',
              paddingTop: 16,
              borderTop: '1px solid var(--border)',
            }}>
              <button
                type="button"
                onClick={() => setMode('password')}
                style={{
                  background: 'none',
                  border: 'none',
                  fontSize: 12,
                  color: 'var(--muted)',
                  cursor: 'pointer',
                }}
              >
                Use password instead
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
