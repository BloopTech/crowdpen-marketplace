import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { getServerSession } from "next-auth";
import SessionProvider from "./components/SessionProvider";
import { authOptions } from "./api/auth/[...nextauth]/route";
import GoogleAnalytics from "./components/googleAnalytics";
import { ThemeProvider } from "next-themes";
import { SWRConfig } from "swr";
import { HomeProvider } from "./context";
import Login from "./(auth)/login";

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

  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable}`}
      suppressHydrationWarning
    >
      <body className="antialiased scroll-auto w-full">
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
          <SessionProvider session={session}>
            <SWRConfig
              value={{
                fetcher,
              }}
            >
              {process.env.NEXT_PUBLIC_GA_ID && (
                <GoogleAnalytics gaId={process.env.NEXT_PUBLIC_GA_ID} />
              )}
              <HomeProvider>
                <main className="flex flex-col w-full">{children}</main>
                <Login />
              </HomeProvider>
            </SWRConfig>
          </SessionProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
