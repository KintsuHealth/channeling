import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { getSupabase } from '@/lib/supabase';

export default function AuthCallback() {
  const router = useRouter();
  const [error, setError] = useState(null);

  useEffect(() => {
    const supabase = getSupabase();
    if (!supabase) {
      router.push('/');
      return;
    }

    const handleCallback = async () => {
      try {
        // Check for error in URL params
        const params = new URLSearchParams(window.location.search);
        const hashParams = new URLSearchParams(window.location.hash.substring(1));

        const errorDesc = params.get('error_description') || hashParams.get('error_description');
        if (errorDesc) {
          setError(errorDesc);
          return;
        }

        // Try to get session from URL (handles both hash and code flows)
        const { data, error: authError } = await supabase.auth.getSession();

        if (authError) {
          console.error('Auth callback error:', authError);
          setError(authError.message);
          return;
        }

        if (data?.session) {
          router.push('/');
          return;
        }

        // If no session yet, wait for auth state change
        const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
          if (session) {
            router.push('/');
          }
        });

        // Cleanup after 5 seconds if nothing happens
        setTimeout(() => {
          subscription.unsubscribe();
          router.push('/');
        }, 5000);

      } catch (err) {
        console.error('Callback error:', err);
        setError(err.message);
      }
    };

    handleCallback();
  }, [router]);

  if (error) {
    return (
      <div style={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#F5F0EB',
        padding: 20,
        fontFamily: 'system-ui, sans-serif',
      }}>
        <div style={{ fontSize: 14, color: '#A0522D', marginBottom: 16, textAlign: 'center' }}>
          {error}
        </div>
        <button
          onClick={() => router.push('/')}
          style={{
            padding: '10px 20px',
            background: '#5C2D0E',
            color: '#fff',
            border: 'none',
            borderRadius: 8,
            fontSize: 14,
            cursor: 'pointer',
          }}
        >
          Go back
        </button>
      </div>
    );
  }

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      background: '#F5F0EB',
      padding: 20,
      fontFamily: 'system-ui, sans-serif',
    }}>
      <div style={{
        width: 32,
        height: 32,
        border: '3px solid #E8DDD3',
        borderTopColor: '#5C2D0E',
        borderRadius: '50%',
        animation: 'spin 0.8s linear infinite',
        marginBottom: 16,
      }} />
      <div style={{ fontSize: 14, color: '#8C7B6F' }}>
        Signing you in...
      </div>
      <style jsx>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
