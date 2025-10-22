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
      headers: {
        "x-api-key": process.env.API_ACCESS_KEY,
      },
      method: "GET",
    });
    return response.json();
  };

  const h = headers();
  const nonce = h.get("x-csp-nonce") || h.get("x-nonce") || "";

  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable}`}
      suppressHydrationWarning
    >
      <body className="antialiased scroll-auto w-full">
        <Script
          src="https://checkout.startbutton.tech/version/latest/sb-web-sdk.min.js"
          strategy="afterInteractive"
          nonce={nonce || undefined}
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
