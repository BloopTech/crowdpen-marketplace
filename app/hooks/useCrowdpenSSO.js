import { useState, useEffect } from 'react';
import { signIn, useSession } from 'next-auth/react';
import { toast } from 'sonner';

export function useCrowdpenSSO() {
  const [isCheckingSSO, setIsCheckingSSO] = useState(false);
  const [ssoAvailable, setSsoAvailable] = useState(false);
  const { data: session, status } = useSession();

  // Check if there's an active Crowdpen session
  const checkCrowdpenSession = async () => {
    try {
      setIsCheckingSSO(true);
      
      // Try to check for active Crowdpen session
      const response = await fetch('/api/auth/check-crowdpen-session', {
        method: 'GET',
        credentials: 'include'
      });
      
      if (response.ok) {
        const data = await response.json();
        setSsoAvailable(data.hasSession || false);
        return data.hasSession ? data : null;
      } else {
        setSsoAvailable(false);
        return null;
      }
    } catch (error) {
      console.error('Error checking Crowdpen session:', error);
      setSsoAvailable(false);
      return null;
    } finally {
      setIsCheckingSSO(false);
    }
  };

  // Attempt SSO login with Crowdpen
  const attemptSSOLogin = async (callbackUrlOverride) => {
    try {
      setIsCheckingSSO(true);
      
      // Skip session check and go directly to Crowdpen SSO endpoint
      const crowdpenUrl = 'https://crowdpen.co'; // Always use production Crowdpen
      const marketplaceUrl = window.location.origin;
      const callbackUrl = callbackUrlOverride || window.location.href;
      const ssoCallbackUrl = `${marketplaceUrl}/api/auth/sso/callback?callbackUrl=${encodeURIComponent(callbackUrl)}`;
      
      // Use correct parameters as specified in SSO endpoint documentation
      const ssoUrl = `${crowdpenUrl}/api/auth/sso?app=marketplace&callback=${encodeURIComponent(ssoCallbackUrl)}&origin=${encodeURIComponent(marketplaceUrl)}`;
      
      console.log('Redirecting to Crowdpen SSO:', ssoUrl);
      
      // Redirect directly to Crowdpen's SSO endpoint
      window.location.href = ssoUrl;
      
      return; // Exit early since we're redirecting
    } catch (error) {
      console.error('SSO login error:', error);
      toast.error('Failed to sign in with Crowdpen');
      return false;
    } finally {
      setIsCheckingSSO(false);
    }
  };

  // Auto-check for SSO on mount if not already logged in
  useEffect(() => {
    if (status === 'unauthenticated') {
      checkCrowdpenSession();
    }
  }, [status]);

  return {
    isCheckingSSO,
    ssoAvailable,
    checkCrowdpenSession,
    attemptSSOLogin,
  };
}
