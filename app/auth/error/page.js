"use client";
import { useSearchParams, useRouter } from 'next/navigation';
import { Button } from '../../components/ui/button';

export default function AuthErrorPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const error = searchParams.get('error');
  
  const getErrorMessage = (errorCode) => {
    switch (errorCode) {
      case 'NoToken':
        return 'No authentication token was provided in the callback.';
      case 'InvalidToken':
        return 'The authentication token is invalid or expired.';
      case 'InvalidUserData':
        return 'The user data provided in the callback is invalid.';
      case 'CallbackError':
        return 'An error occurred during the authentication callback.';
      default:
        return 'An unknown authentication error occurred.';
    }
  };
  
  return (
    <div className="min-h-screen flex items-center justify-center" data-testid="auth-error">
      <div className="text-center max-w-md" data-testid="auth-error-content">
        <h1 className="text-2xl font-bold mb-4 text-red-600">Authentication Error</h1>
        <p className="text-gray-600 mb-6">{getErrorMessage(error)}</p>
        <div className="space-y-3">
          <Button 
            onClick={() => router.push('/')}
            className="w-full"
            data-testid="auth-error-home"
          >
            Return to Home
          </Button>
          <Button 
            variant="outline"
            onClick={() => router.push('/auth/signin')}
            className="w-full"
            data-testid="auth-error-try-again"
          >
            Try Again
          </Button>
        </div>
      </div>
    </div>
  );
}
