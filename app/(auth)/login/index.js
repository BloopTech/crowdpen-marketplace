"use client";
import React, { useState, useContext, useEffect, useCallback } from "react";
import { Button } from "../../components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "../../components/ui/dialog";
import { LoaderCircle } from "lucide-react";
import { signIn } from "next-auth/react";
import { toast } from "sonner";
import { useHome } from "../../context";
import { useCrowdpenSSO } from "../../hooks/useCrowdpenSSO";

// Login component that integrates with Crowdpen SSO
export default function Login() {
  // Get context safely with useContext
  const { loginDialog, closeLoginDialog } = useHome();
  
  // Use the Crowdpen SSO hook
  const { isCheckingSSO, ssoAvailable, attemptSSOLogin } = useCrowdpenSSO();
  
  // Handle SSO login with Crowdpen credentials
  const handleCrowdpenLogin = useCallback(async () => {
    const success = await attemptSSOLogin();
    if (success) {
      closeLoginDialog();
    }
  }, [attemptSSOLogin, closeLoginDialog]);
  
  // Auto-attempt SSO login when dialog opens if SSO is available
  useEffect(() => {
    if (loginDialog && ssoAvailable && !isCheckingSSO) {
      // Show a brief message and auto-login
      toast.info('Signing you in with your Crowdpen account...');
      handleCrowdpenLogin();
    }
  }, [loginDialog, ssoAvailable, isCheckingSSO, handleCrowdpenLogin]);
  
  // Don't render anything if login dialog is not open
  if (!loginDialog) return null;
  
  return (
    <Dialog open={loginDialog} onOpenChange={closeLoginDialog}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Sign in to Crowdpen Marketplace</DialogTitle>
          <DialogDescription>
            Use your existing Crowdpen account to sign in.
          </DialogDescription>
        </DialogHeader>
        
        <div className="flex flex-col space-y-4 py-4">
          {isCheckingSSO ? (
            <div className="flex items-center justify-center py-4">
              <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />
              <span>Checking for existing Crowdpen session...</span>
            </div>
          ) : (
            <>
              {ssoAvailable && (
                <div className="text-sm text-green-600 bg-green-50 p-3 rounded-md mb-2">
                  ✓ Active Crowdpen session detected. You can sign in automatically.
                </div>
              )}
              
              <Button
                onClick={handleCrowdpenLogin}
                disabled={isCheckingSSO}
                className="w-full">
                {isCheckingSSO ? (
                  <>
                    <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />
                    Signing in...
                  </>
                ) : ssoAvailable ? (
                  "Sign in with Crowdpen Account"
                ) : (
                  "Sign in with Crowdpen (will redirect)"
                )}
              </Button>
              
              {!ssoAvailable && (
                <div className="text-xs text-gray-500 text-center">
                  No active Crowdpen session found. You&apos;ll be redirected to sign in.
                </div>
              )}
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
