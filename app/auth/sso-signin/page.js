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
        const userData = searchParams.get('userData');
        const callbackUrl = searchParams.get('callbackUrl') || '/';
        
        if (!userData) {
          setError('No user data provided');
          setStatus('error');
          return;
        }
        
        console.log('Processing SSO sign-in with user data:', userData.substring(0, 100) + '...');
        
        // Use direct database session creation for email authentication
        console.log('Creating direct database session for email authentication');
        
        const response = await fetch('/api/auth/sso/signin', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            userData,
            callbackUrl
          })
        });
        
        const result = await response.json();
        console.log('Direct session creation result:', JSON.stringify(result, null, 2));
        
        if (result.success) {
          setStatus('success');
          console.log('SSO sign-in successful, redirecting to:', result.redirectUrl);
          // Use window.location.href to ensure session is established
          window.location.href = result.redirectUrl;
        } else {
          throw new Error(result.error || 'Failed to create database session');
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
