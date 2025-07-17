"use client";
import { useEffect, useState } from 'react';
import { signIn } from 'next-auth/react';
import { useSearchParams, useRouter } from 'next/navigation';
import { LoaderCircle } from 'lucide-react';

export default function SSOSignInPage() {
  const [status, setStatus] = useState('processing');
  const [error, setError] = useState(null);
  const searchParams = useSearchParams();
  const router = useRouter();
  
  useEffect(() => {
    const processSSO = async () => {
      try {
        const user = searchParams.get('user');
        const callbackUrl = searchParams.get('callbackUrl') || '/';
        
        if (!user) {
          setError('No user data provided');
          setStatus('error');
          return;
        }
        
        console.log('Processing SSO sign-in with user data:', user.substring(0, 100) + '...');
        
        // Make direct API call to create session instead of using NextAuth signIn
        console.log('Making direct API call to create SSO session');
        
        const response = await fetch('/api/auth/signin/credentials', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          body: new URLSearchParams({
            user,
            redirect: 'false',
            json: 'true'
          })
        });
        
        const result = await response.json();
        console.log('Direct API SignIn result:', JSON.stringify(result, null, 2));
        
        if (response.ok && result?.url) {
          setStatus('success');
          console.log('SSO sign-in successful, redirecting to:', callbackUrl);
          // Use window.location.href to ensure session is established
          window.location.href = callbackUrl || '/';
        } else {
          throw new Error(result?.error || `Sign in failed: ${response.status}`);
        }
      } catch (error) {
        console.error('SSO processing error:', error);
        setError(error.message);
        setStatus('error');
      }
    };
    
    processSSO();
  }, [searchParams, router]);
  
  if (status === 'processing') {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <LoaderCircle className="h-8 w-8 animate-spin mx-auto mb-4" />
          <h2 className="text-xl font-semibold mb-2">Signing you in...</h2>
          <p className="text-gray-600">Please wait while we complete your sign-in from Crowdpen.</p>
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
