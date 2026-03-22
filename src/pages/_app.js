import "@/styles/globals.css";
import { AuthProvider } from "@/lib/useAuth";
import { AuthWrapper } from "@/components/AuthWrapper";
import { useRouter } from "next/router";

export default function App({ Component, pageProps }) {
  const router = useRouter();
  const isAuthCallback = router.pathname === '/auth/callback';

  return (
    <AuthProvider>
      {isAuthCallback ? (
        <Component {...pageProps} />
      ) : (
        <AuthWrapper>
          <Component {...pageProps} />
        </AuthWrapper>
      )}
    </AuthProvider>
  );
}
