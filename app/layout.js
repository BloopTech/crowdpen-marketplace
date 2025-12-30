import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { getServerSession } from "next-auth";
import SessionProvider from "./components/SessionProvider";
import { authOptions } from "./api/auth/[...nextauth]/route";
import GoogleAnalytics from "./components/googleAnalytics";
import Script from "next/script";
import { headers } from "next/headers";
import { ThemeProvider } from "next-themes";
import { SWRConfig } from "swr";
import { HomeProvider } from "./context";
import { TooltipProvider } from "./components/ui/tooltip";
import Login from "./(auth)/login";
import QueryProvider from "./components/QueryProvider";
import { NuqsAdapter } from "nuqs/adapters/next/app";
import { Toaster } from "sonner";
import IdleLogout from "./components/IdleLogout";

export const dynamic = "force-dynamic";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata = {
  title: "Crowdpen-Marketplace",
  description: "Crowdpen-Marketplace",
};

export default async function RootLayout({ children }) {
  const session = await getServerSession(authOptions);
  //console.log("session.....................", session)

  const fetcher = async (url) => {
    "use server";
    const response = await fetch(url, {
      method: "GET",
    });
    return response.json();
  };

  const h = await headers();
  const nonce = h.get("x-csp-nonce") || h.get("x-nonce") || "";

  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable}`}
      suppressHydrationWarning
    >
      <head>
        <meta name="csp-nonce" content={nonce} />
        <meta property="csp-nonce" content={nonce} />
      </head>
      <body className="antialiased scroll-auto w-full">
        {/* StartButton SDK: pin via env, fallback to latest if missing */}
        <Script
          src={process.env.NEXT_PUBLIC_SB_SDK_SRC || "https://checkout.startbutton.tech/version/latest/sb-web-sdk.min.js"}
          strategy="afterInteractive"
          nonce={nonce || undefined}
        />
        <Script
          id="sb-fallback-loader"
          strategy="afterInteractive"
          nonce={nonce || undefined}
          dangerouslySetInnerHTML={{
            __html: `(() => {try {setTimeout(() => {try {if (!window.SBInit) { var s = document.createElement('script'); s.src = 'https://checkout.startbutton.tech/version/latest/sb-web-sdk.min.js'; s.async = true; document.head.appendChild(s); }} catch(_) {}}, 2000);} catch(_) {}})();`,
          }}
        />
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
          <SessionProvider session={session}>
            <QueryProvider>
              {process.env.NEXT_PUBLIC_GA_ID && (
                <GoogleAnalytics gaId={process.env.NEXT_PUBLIC_GA_ID} />
              )}

              <NuqsAdapter>
                <TooltipProvider>
                  <HomeProvider>
                  <Toaster
                    position="top-right"
                    expand={true}
                    richColors
                    closeButton
                    // toastOptions={{
                    //   style: {
                    //     fontFamily: "var(--font-poppins)",
                    //   },
                    // }}
                  />

                  <IdleLogout />
                  <main className="flex flex-col w-full">{children}</main>
                  <Login />
                  </HomeProvider>
                </TooltipProvider>
              </NuqsAdapter>
            </QueryProvider>
          </SessionProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
