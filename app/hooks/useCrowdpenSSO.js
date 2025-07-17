import { useState, useEffect } from 'react';
import { signIn, useSession } from 'next-auth/react';
import { toast } from 'sonner';

export function useCrowdpenSSO() {
  const [isCheckingSSO, setIsCheckingSSO] = useState(false);
  const [ssoAvailable, setSsoAvailable] = useState(false);
  const { data: session, status } = useSession();

  // SSO is always available - let Crowdpen handle the session check
  const checkCrowdpenSession = async () => {
    // Skip session checking - always return null to trigger redirect
    setSsoAvailable(true);
    return null;
  };

  // Attempt SSO login with Crowdpen
  const attemptSSOLogin = async () => {
    try {
      setIsCheckingSSO(true);
      
      // Skip session check and go directly to Crowdpen SSO endpoint
      const crowdpenUrl = 'https://crowdpen.co'; // Always use production Crowdpen
      const marketplaceUrl = window.location.origin;
      const callbackUrl = `${marketplaceUrl}/api/auth/sso/callback`;
      
      // Use correct parameters as specified in SSO endpoint documentation
      const ssoUrl = `${crowdpenUrl}/api/auth/sso?app=marketplace&callback=${encodeURIComponent(callbackUrl)}&origin=${encodeURIComponent(marketplaceUrl)}`;
      
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
