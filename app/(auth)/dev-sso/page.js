"use client";

import { useState } from 'react';
import { signIn } from 'next-auth/react';
import { useRouter } from 'next/navigation';

/**
 * Development-only SSO testing page
 * This page allows us to test the SSO flow without having to modify the Crowdpen app
 */
export default function DevSSO() {
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState('');
  const router = useRouter();
  
  const handleSignIn = async (e) => {
    e.preventDefault();
    
    if (!email || !email.includes('@')) {
      setStatus('Please enter a valid email');
      return;
    }
    
    setStatus('Signing in...');
    
    try {
      // Store the email in localStorage for future use
      localStorage.setItem('crowdpen_test_email', email);
      
      const result = await signIn('credentials', {
        redirect: false,
        email,
      });
      
      if (result.error) {
        setStatus(`Error: ${result.error}`);
      } else {
        setStatus('Success! Redirecting...');
        router.push('/');
      }
    } catch (error) {
      setStatus(`Error: ${error.message}`);
    }
  };
  
  return (
    <div className="flex min-h-screen flex-col items-center justify-center p-4">
      <div className="w-full max-w-md p-6 bg-white rounded-lg shadow-md">
        <h1 className="text-2xl font-bold mb-6 text-center">Development SSO Testing</h1>
        
        <div className="mb-4 p-3 bg-yellow-100 text-yellow-800 rounded">
          <strong>Note:</strong> This page is for development testing only. It allows you to simulate
          the SSO flow without having to modify the Crowdpen app.
        </div>
        
        <form onSubmit={handleSignIn} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Email (from Crowdpen database)
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full p-2 border border-gray-300 rounded"
              placeholder="user@example.com"
            />
          </div>
          
          <button
            type="submit"
            className="w-full bg-blue-600 text-white py-2 px-4 rounded hover:bg-blue-700"
          >
            Sign In with this Email
          </button>
        </form>
        
        {status && (
          <div className="mt-4 p-3 bg-gray-100 text-gray-800 rounded">
            {status}
          </div>
        )}
        
        <div className="mt-6">
          <h2 className="font-semibold mb-2">How to use this:</h2>
          <ol className="list-decimal pl-5 space-y-2">
            <li>Enter an email that exists in your shared Crowdpen database</li>
            <li>Click &quot;Sign In with this Email&quot;</li>
            <li>If the email exists, you&apos;ll be authenticated</li>
            <li>This simulates what would happen if Crowdpen passed the email to this app</li>
          </ol>
        </div>
      </div>
    </div>
  );
}
