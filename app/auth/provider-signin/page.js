"use client";
import { useEffect, useState } from 'react';
import { signIn } from 'next-auth/react';
import { useSearchParams, useRouter } from 'next/navigation';
import { LoaderCircle } from 'lucide-react';

export default function ProviderSignInPage() {
  const [status, setStatus] = useState('processing');
  const [error, setError] = useState(null);
  const [providerName, setProviderName] = useState('');
  const searchParams = useSearchParams();
  const router = useRouter();
  
  useEffect(() => {
    const processProviderSignIn = async () => {
      try {
        const email = searchParams.get('email');
        const provider = searchParams.get('provider');
        const callbackUrl = searchParams.get('callbackUrl') || '/';
        
        if (!email || !provider) {
          setError('Missing email or provider information');
          setStatus('error');
          return;
        }
        
        console.log('Processing provider sign-in:', { email, provider, callbackUrl });
        
        // Map provider names to NextAuth provider IDs
        const providerMap = {
          'email': 'email',
          'github': 'github', 
          'google': 'google'
        };
        
        const nextAuthProvider = providerMap[provider.toLowerCase()];
        if (!nextAuthProvider) {
          setError(`Unsupported provider: ${provider}`);
          setStatus('error');
          return;
        }
        
        setProviderName(provider);
        
        console.log(`Using NextAuth provider: ${nextAuthProvider} for email: ${email}`);
        
        // For email provider, we need to handle it differently
        if (nextAuthProvider === 'email') {
          console.log('Handling email provider sign-in');
          // For email provider, we can use the email credentials provider
          const result = await signIn('email-credentials', {
            email,
            redirect: false,
          });
          
          console.log('Email credentials SignIn result:', JSON.stringify(result, null, 2));
          
          if (result?.ok) {
            setStatus('success');
            console.log('Email provider sign-in successful, redirecting to:', callbackUrl);
            window.location.href = callbackUrl;
          } else {
            throw new Error(result?.error || 'Email provider sign in failed');
          }
        } else {
          // For OAuth providers (GitHub, Google), we need to redirect to their OAuth flow
          console.log(`Redirecting to ${nextAuthProvider} OAuth flow`);
          
          // Store the email in sessionStorage so we can validate it after OAuth callback
          sessionStorage.setItem('sso_expected_email', email);
          sessionStorage.setItem('sso_callback_url', callbackUrl);
          
          // Redirect to OAuth provider
          const result = await signIn(nextAuthProvider, {
            callbackUrl: callbackUrl,
            redirect: true, // Let NextAuth handle the redirect
          });
          
          // This won't execute if redirect is true, but keeping for safety
          if (result?.error) {
            throw new Error(result.error);
          }
        }
        
      } catch (error) {
        console.error('Provider sign-in error:', error);
        setError(error.message);
        setStatus('error');
      }
    };
    
    processProviderSignIn();
  }, [searchParams, router]);
  
  if (status === 'processing') {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <LoaderCircle className="h-8 w-8 animate-spin mx-auto mb-4" />
          <h2 className="text-xl font-semibold mb-2">Signing you in...</h2>
          <p className="text-gray-600">
            {providerName ? 
              `Completing sign-in with ${providerName.charAt(0).toUpperCase() + providerName.slice(1)}...` :
              'Please wait while we complete your sign-in from Crowdpen.'
            }
          </p>
        </div>
      </div>
    );
  }
  
  if (status === 'error') {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-xl font-semibold mb-2 text-red-600">Sign-in Error</h2>
          <p className="text-gray-600 mb-4">{error}</p>
          <button 
            onClick={() => router.push('/')}
            className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600"
          >
            Return to Home
          </button>
        </div>
      </div>
    );
  }
  
  if (status === 'success') {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-xl font-semibold mb-2 text-green-600">Sign-in Successful!</h2>
          <p className="text-gray-600">Redirecting you now...</p>
        </div>
      </div>
    );
  }
  
  return null;
}
