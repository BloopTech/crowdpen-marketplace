"use client";
import React, { useState, useContext } from "react";
import { Button } from "../../components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "../../components/ui/dialog";
import { HomeContext } from "../../context";
import { LoaderCircle } from "lucide-react";
import { signIn } from "next-auth/react";
import { toast } from "sonner";

// Login component that integrates with Crowdpen SSO
export default function Login() {
  // Get context safely with useContext
  const context = useContext(HomeContext);

  // State for Crowdpen SSO login
  const [isCrowdpenLoading, setIsCrowdpenLoading] = useState(false);
  
  // If context isn't available yet, render nothing
  if (!context) return null;
  
  // Now we can safely use the context
  const { loginDialog, closeLoginDialog } = context;
  
  // Handle SSO login with Crowdpen credentials
  const handleCrowdpenLogin = async () => {
    try {
      setIsCrowdpenLoading(true);
      await signIn('credentials', { 
        redirect: false,
        callbackUrl: '/'
      });
      closeLoginDialog();
    } catch (error) {
      console.error("Login error:", error);
      toast.error("Failed to login with Crowdpen");
    } finally {
      setIsCrowdpenLoading(false);
    }
  };
  
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
          <Button
            onClick={handleCrowdpenLogin}
            disabled={isCrowdpenLoading}
            className="w-full">
            {isCrowdpenLoading ? (
              <>
                <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />
                Signing in...
              </>
            ) : (
              "Sign in with Crowdpen Account"
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
