import { useEffect } from 'react';
import { useRouter } from 'next/router';
import { getSupabase } from '@/lib/supabase';

export default function AuthCallback() {
  const router = useRouter();

  useEffect(() => {
    const supabase = getSupabase();
    if (!supabase) {
      router.push('/');
      return;
    }

    const handleCallback = async () => {
      const { error } = await supabase.auth.exchangeCodeForSession(
        window.location.href
      );

      if (error) {
        console.error('Auth callback error:', error);
      }

      router.push('/');
    };

    handleCallback();
  }, [router]);

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'var(--bg)',
      padding: 20,
    }}>
      <div style={{
        width: 32,
        height: 32,
        border: '3px solid var(--border)',
        borderTopColor: 'var(--accent)',
        borderRadius: '50%',
        animation: 'spin 0.8s linear infinite',
        marginBottom: 16,
      }} />
      <div style={{
        fontSize: 14,
        color: 'var(--muted)',
      }}>
        Signing you in...
      </div>
    </div>
  );
}
