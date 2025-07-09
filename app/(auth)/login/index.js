"use client";
import React, { useState, useEffect } from "react";
import { Button } from "../../components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../../components/ui/dialog";
import Link from "next/link";
import { useHome } from "../../context";
import { LoaderCircle } from "lucide-react";
import Image from "next/image";
import { signIn, useSession } from "next-auth/react";
import axios from "axios";
import { useRouter, useSearchParams } from "next/navigation";

export default function Login() {
  const { loginDialog, openLoginDialog, closeLoginDialog } = useHome();

  const [formValues, setFormValues] = useState({ email: "" });
  const [loginError, setLoginError] = useState("");
  const [disabled, setDisabled] = useState(false);
  const [loginLoading, setLoginLoading] = useState(false);
  const [isValid, setIsValid] = useState(true);
  const [isCrowdpenLoading, setIsCrowdpenLoading] = useState(false);

  const { email } = formValues;

  const router = useRouter();
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get("callbackUrl");
  const referralCode = searchParams.get("referralCode");

  const callback =
    callbackUrl !== undefined
      ? callbackUrl
      : referralCode !== undefined
      ? `${process.env.NEXTAUTH_URL}?referralCode=${referralCode}`
      : "/";

  const validateEmail = (input) => {
    const emailPattern = /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,4}$/i;
    return emailPattern.test(input);
  };

  useEffect(() => {
    if (email) {
      setIsValid(validateEmail(email));
    }
  }, [email]);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormValues({ ...formValues, [name]: value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!isValid) return;
    setLoginLoading(true);
    setDisabled(true);

    try {
      const myemail = email.toLowerCase();
      const payload = {
        email: myemail,
      };
      const getUser = await axios.post(`/api/auth/users/login`, payload);
      //console.log("getUser email login", getUser);
      if (getUser?.data) {
        const status = await signIn("email", {
          redirect: false,
          email: myemail,

          callbackUrl: callback,
        });

        setDisabled(false);
        setLoginLoading(false);
        //console.log("status................", status);

        if (!status?.error) {
          router.push(status.url);
        } else {
          setLoginError(`Error: ${status?.error}`);
        }
      }
    } catch (error) {
      const message =
        (error.response &&
          error.response.data &&
          error.response.data.message) ||
        error.message ||
        error.toString();
      setDisabled(false);
      setLoginLoading(false);
      //console.log("login error", error);
      setLoginError(message);
    }
  };

  const GoogleSignIn = () => {
    signIn("google", { callbackUrl: callback });
  };

  const GithubSignIn = () => {
    signIn("github", {
      callbackUrl: callback,
    });
  };

  // Function to handle login with Crowdpen
  const CrowdpenSignIn = async () => {
    setIsCrowdpenLoading(true);
    setDisabled(true);
    setLoginError('');
    
    try {
      // First, check if the user is already logged in on Crowdpen
      console.log('Checking for existing Crowdpen session...');
      const response = await fetch('/api/proxy/crowdpen-session', {
        credentials: 'include',
        cache: 'no-store'
      });
      
      const data = await response.json();
      console.log('Crowdpen session response:', data);
      
      // If we found an active Crowdpen session with user data, use it to sign in
      if (data?.user?.email) {
        console.log(`Found active Crowdpen session for: ${data.user.email}`);
        
        // Use the email from the Crowdpen session to sign in here
        const result = await signIn('credentials', {
          redirect: false,
          email: data.user.email
        });
        
        console.log('Sign in result:', result);
        
        if (result?.error) {
          setLoginError(`Authentication error: ${result.error}`);
        } else {
          // Success! Close dialog and redirect
          console.log('Successfully signed in with Crowdpen session');
          closeLoginDialog();
          router.push(result.url || callback || '/');
          return;
        }
      } else {
        // No active Crowdpen session found, redirect to Crowdpen login
        console.log('No active Crowdpen session found. Redirecting to Crowdpen login...');
        
        // Build the callback URL to return to after Crowdpen login
        const callbackUrl = encodeURIComponent(`${window.location.origin}/api/auth/callback/crowdpen`);
        const crowdpenLoginUrl = `https://crowdpen.co/login?callbackUrl=${callbackUrl}`;
        
        console.log(`Redirecting to: ${crowdpenLoginUrl}`);
        window.location.href = crowdpenLoginUrl;
      }
    } catch (error) {
      console.error('Crowdpen login error:', error);
      setLoginError(`Error: ${error.message}`);
      setIsCrowdpenLoading(false);
      setDisabled(false);
    }
  };

  return (
    <Dialog open={loginDialog} onOpenChange={closeLoginDialog}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Login to your account</DialogTitle>
          <DialogDescription>
            Sign in to access your account, wishlist, and purchases.
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-4 py-4">
          <div className="w-full mt-[1rem]">
            <button
              type="button"
              onClick={CrowdpenSignIn}
              disabled={disabled}
              className="w-full text-sm cursor-pointer font-poynterroman flex items-center font-semibold justify-center p-2 transition-colors duration-300 bg-white border text-gray-700 dark:text-black rounded-lg focus:shadow-outline hover:bg-slate-200 border-gray-700 focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-gray-700 disabled:bg-gray-100 disabled:text-gray-400 disabled:cursor-not-allowed"
            >
              {isCrowdpenLoading ? (
                <span className="flex justify-center items-center">
                  <LoaderCircle className="animate-spin h-5 w-5 mr-3" />
                  Connecting to Crowdpen...
                </span>
              ) : (
                <>
                  <Image
                    width={40}
                    height={40}
                    src="/crowdpen_icon.png"
                    alt="crowdpen logo"
                    priority
                  />
                  <span className="text-sm font-medium ml-2">
                    Login with Crowdpen
                  </span>
                </>
              )}
            </button>
          </div>
          
          <div className="w-full flex items-center justify-center my-2">
            <div className="flex-grow border-t border-gray-300 dark:border-gray-700"></div>
            <span className="mx-4 text-sm text-gray-500 dark:text-gray-400 font-poynterroman">OR</span>
            <div className="flex-grow border-t border-gray-300 dark:border-gray-700"></div>
          </div>

          <form
            onSubmit={handleSubmit}
            className="w-full flex flex-col space-y-2"
          >
            {loginError && (
              <p className="text-center text-sm bg-red-100 border-l-red-500 border-l-4 py-4 mb-6 rounded">
                {loginError}
              </p>
            )}
            <div className="flex flex-col w-full">
              <label htmlFor="email" className="text-sm font-poynterroman">
                Email Address
              </label>
              <input
                required
                id="email"
                name="email"
                autoComplete="email"
                value={email}
                onChange={handleInputChange}
                disabled={disabled}
                className={`border border-slate-200 p-2 rounded-md form-input text-sm font-poynterroman dark:text-white dark:caret-white dark:bg-[#1a1a1a] dark:focus:border-none dark:focus:outline-none dark:focus:ring dark:focus:ring-[#d3a155] ${
                  !isValid &&
                  email &&
                  "focus:border-red-500 border-red-500 focus:ring-red-500"
                }`}
              />
              {!isValid && email && (
                <span className="text-red-500 text-xs font-poynterroman">
                  Invalid email address
                </span>
              )}
            </div>
            {loginLoading ? (
              <button
                disabled={disabled}
                className="text-sm font-poynterroman disabled:bg-[#eeeeee] dark:disabled:bg-[#8a8a8a] dark:text-black dark:bg-[#d3a155] mt-5 mb-3 disabled:text-black flex items-center justify-center hover:border-black hover:border text-white bg-black px-4 py-2 rounded-lg w-full disabled:cursor-not-allowed disabled:pointer-events-none "
              >
                <span className="flex justify-center items-center">
                  <LoaderCircle className="animate-spin h-5 w-5 mr-3 text-black disabled:text-black dark:text-white dark:disabled:text-[#8a8a8a]" />
                </span>
                signing in...
              </button>
            ) : (
              <button
                type="submit"
                disabled={disabled}
                className="text-sm cursor-pointer font-poynterroman focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-gray-700 p-2 border rounded-lg bg-black w-full dark:bg-[#d3a155] dark:text-black text-white"
              >
                <span className="text-sm font-medium flex items-center justify-center">
                  Login
                </span>
              </button>
            )}
          </form>
          <div className="w-full flex items-center justify-center my-2">
            <div className="flex-grow border-t border-gray-300 dark:border-gray-700"></div>
            <span className="mx-4 text-sm text-gray-500 dark:text-gray-400 font-poynterroman">OR</span>
            <div className="flex-grow border-t border-gray-300 dark:border-gray-700"></div>
          </div>

          <div className="flex flex-col gap-4 w-full">
            <button
              onClick={GoogleSignIn}
              className="text-sm cursor-pointer font-poynterroman flex items-center font-semibold justify-center p-2 transition-colors duration-300 bg-white border text-gray-700 dark:text-black rounded-lg focus:shadow-outline hover:bg-slate-200 border-gray-700 focus:outline-none lg:w-auto w-full focus:ring-2 focus:ring-offset-1 focus:ring-gray-700"
            >
              <Image
                width={20}
                height={20}
                //src="https://www.svgrepo.com/show/475656/google-color.svg"
                src="/google.svg"
                alt="google logo"
                priority
              />
              <span className="text-sm font-medium ml-4">
                Login with Google
              </span>
            </button>

            <button
              onClick={GithubSignIn}
              type="button"
              className="text-sm cursor-pointer font-poynterroman flex items-center font-semibold justify-center p-2 transition-colors duration-300 bg-white border text-gray-700 dark:text-black rounded-lg focus:shadow-outline hover:bg-slate-200 border-gray-700 focus:outline-none lg:w-auto w-full focus:ring-2 focus:ring-offset-1 focus:ring-gray-700"
            >
              <Image
                width={20}
                height={20}
                src="/github.png"
                alt="github logo"
                priority
              />
              <span className="text-sm font-medium ml-4">
                Login with Github
              </span>
            </button>
          </div>
        </div>
        <DialogFooter className="flex justify-between items-center">
          <div>
            <Link
              href={`https://crowdpen.co/signup?callbackUrl=${encodeURIComponent(
                callback
              )}`}
            >
              <p className="text-sm text-[#D3A155] mb-[2rem] font-poynterroman">
                {"Don't have an account? Sign Up"}
              </p>
            </Link>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
