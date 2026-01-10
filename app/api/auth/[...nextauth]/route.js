import NextAuth from "next-auth";
import SequelizeAdapter from "@auth/sequelize-adapter";
import sequelize from "../../../models/database";
import { getUserId } from "../../../cacher";
import CredentialsProvider from "next-auth/providers/credentials";
import Email from "next-auth/providers/email";
import GitHub from "next-auth/providers/github";
import Google from "next-auth/providers/google";
import sendVerificationRequest from "../../../lib/EmailVerification";
import axios from "axios";
import { cookies } from "next/headers";
import { assertRequiredEnvInProduction } from "../../../lib/env";
import crypto from "crypto";
import { reportError } from "../../../lib/observability/reportError";

export const runtime = "nodejs";

// Determine the absolute URL for the app
const absoluteUrl = process.env.NEXTAUTH_URL;

assertRequiredEnvInProduction(["NEXTAUTH_URL", "NEXTAUTH_SECRET", "DB_URL"]);

// Helper function for SSO user data authentication
export async function handleUserData(userData) {
  try {
    console.log("=== SSO USER DATA AUTH START ===");
    console.log("User data provided:", userData ? "YES" : "NO");

    if (!userData) {
      await reportError(new Error("No user data provided for SSO auth"), {
        tag: "sso_user_data_auth",
        route: "/api/auth/[...nextauth]",
        extra: {
          stage: "missing_user_data",
        },
      });
      return null;
    }

    // Parse user data if it's a string
    let parsedUserData;
    if (typeof userData === "string") {
      try {
        // First decode URL-encoded data, then parse JSON
        const decodedData = decodeURIComponent(userData);
        //console.log('Decoded user data:', decodedData);
        parsedUserData = JSON.parse(decodedData);
      } catch (parseError) {
        await reportError(parseError, {
          tag: "sso_user_data_auth",
          route: "/api/auth/[...nextauth]",
          extra: {
            stage: "parse_user_data",
          },
        });
        return null;
      }
    } else {
      parsedUserData = userData;
    }

    //console.log('Parsed user data:', parsedUserData);

    if (!parsedUserData.email) {
      await reportError(new Error("No email in user data"), {
        tag: "sso_user_data_auth",
        route: "/api/auth/[...nextauth]",
        extra: {
          stage: "missing_email",
        },
      });
      return null;
    }

    // Since both apps share the same database, look up the user directly
    const user = await sequelize.models.User.findOne({
      where: { email: parsedUserData.email },
    });

    if (user) {
      //console.log('Found existing user in shared database:', user);
      console.log("=== SSO AUTHORIZE SUCCESS - EXISTING USER ===");
      return user;
    }

    // If the user doesn't exist in our shared database,
    // they need to sign up on Crowdpen first
    console.log(
      "User not found in shared database - must sign up on Crowdpen first"
    );
    console.log("=== SSO AUTHORIZE FAILED - USER NOT FOUND ===");
    return null;
  } catch (error) {
    await reportError(error, {
      tag: "sso_user_data_auth",
      route: "/api/auth/[...nextauth]",
      extra: {
        stage: "unhandled",
      },
    });
    return null;
  }
}

function safeTimingEqual(a, b) {
  try {
    const aBuf = Buffer.from(String(a || ""));
    const bBuf = Buffer.from(String(b || ""));
    if (aBuf.length !== bBuf.length) return false;
    return crypto.timingSafeEqual(aBuf, bBuf);
  } catch {
    return false;
  }
}

// handleEmailAuth function removed - now using built-in NextAuth Email provider

export const authOptions = {
  providers: [
    Email({
      maxAge: 60 * 60,
      sendVerificationRequest,
    }),
    GitHub({
      clientId: process.env.GITHUB_CLIENT_ID,
      clientSecret: process.env.GITHUB_SECRET_ID,
      httpOptions: {
        timeout: 40000,
      },
    }),
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      httpOptions: {
        timeout: 40000,
      },
    }),

    // SSO credentials provider for Crowdpen authentication
    CredentialsProvider({
      id: "crowdpen-sso",
      name: "Crowdpen SSO",
      credentials: {
        userData: { label: "User Data", type: "text" },
        ts: { label: "Timestamp", type: "text" },
        sig: { label: "Signature", type: "text" },
      },
      async authorize(credentials) {
        console.log("=== CROWDPEN SSO AUTHORIZE START ===");

        if (credentials?.userData) {
          console.log("Processing SSO user data authentication");

          const isProd = process.env.NODE_ENV === "production";
          if (isProd) {
            const secret = process.env.CROWDPEN_SSO_SECRET;
            if (!secret) {
              return null;
            }

            const tsNum = Number.parseInt(String(credentials?.ts || ""), 10);
            if (!Number.isFinite(tsNum)) {
              return null;
            }

            const maxSkewMs = 5 * 60 * 1000;
            const skew = Math.abs(Date.now() - tsNum);
            if (!Number.isFinite(skew) || skew > maxSkewMs) {
              return null;
            }

            const userDataText = String(credentials.userData || "");
            const payload = `${tsNum}.${userDataText}`;
            const expected = crypto
              .createHmac("sha256", secret)
              .update(payload)
              .digest("hex");

            if (!safeTimingEqual(expected, String(credentials?.sig || ""))) {
              return null;
            }
          }

          const result = await handleUserData(credentials.userData);
          return result;
        }

        console.log("=== CROWDPEN SSO AUTHORIZE - NO USER DATA ===");
        return null;
      },
    }),
  ],

  adapter: SequelizeAdapter(sequelize),
  session: {
    strategy: "database",
    maxAge: 30 * 24 * 60 * 60, // 30 days
    updateAge: 24 * 60 * 60, // 24 hours
  },
  events: {
    // createUser: sendWelcomeEmail,
  },
  pages: {
    signIn: "https://crowdpen.co/login",
    //signOut: "/auth/signout",
    //error: "/auth/error", // Error code passed in query string as ?error=
    verifyRequest: `https://crowdpen.co/verify-request`, // (used for check email message)
    newUser: `https://crowdpen.co/new-user`, // New users will be directed here on first sign in (leave the property out if not of interest)
  },
  callbacks: {
    async signIn({ user, account, profile, email, credentials }) {
      console.log("=== SIGNIN CALLBACK START ===");
      // console.log('User:', user);
      // console.log('Account:', account);
      // console.log('Profile:', profile);
      // console.log('Email:', email);
      // console.log('Credentials:', credentials);

      // Debug: Log the actual user object structure
      if (user) {
        console.log("=== USER OBJECT DEBUG ===");
        // console.log('User object keys:', Object.keys(user));
        // console.log('User object:', JSON.stringify(user, null, 2));
      }

      // For OAuth providers coming from SSO, validate the user exists in database
      if (
        account?.provider &&
        ["github", "google", "email"].includes(account.provider)
      ) {
        console.log("=== OAUTH PROVIDER SIGNIN CALLBACK ===");
        //console.log('Provider:', account.provider, 'User email:', user.email);

        // Check if this is an SSO flow by looking for expected email in session storage
        // Note: This will be handled client-side, but we can still validate here

        // Validate user email
        if (!user.email) {
          await reportError(new Error("User email is missing in OAuth callback"), {
            tag: "nextauth_signin",
            route: "/api/auth/[...nextauth]",
            extra: {
              stage: "missing_email",
              provider: account?.provider || null,
            },
          });
          //console.error('User object:', user);
          return false;
        }

        try {
          // Check if user exists in database
          let dbUser = await sequelize.models.User.findOne({
            where: { email: user.email },
          });

          if (!dbUser) {
            console.log(
              "User not found in database - this might be a new OAuth sign-up or SSO user who needs to sign up on Crowdpen first"
            );
            // For now, allow OAuth sign-ins to proceed (existing NextAuth behavior)
            // In the future, we might want to restrict this for SSO flows only
          } else {
            //console.log('Found existing user in database:', dbUser.id);

            // Update user object with database ID to ensure consistency
            user.id = dbUser.id;
            user.email = dbUser.email;
            user.name = dbUser.name || user.name;
            user.image = dbUser.image || user.image;

            console.log("=== OAUTH DATABASE USER VALIDATED ===");
          }
        } catch (error) {
          await reportError(error, {
            tag: "nextauth_signin",
            route: "/api/auth/[...nextauth]",
            extra: {
              stage: "validate_oauth_user_db",
              provider: account?.provider || null,
            },
          });
          // Don't fail the sign-in for database errors, let NextAuth handle it
        }
      }

      const result = true;
      //console.log('=== SIGNIN CALLBACK RESULT:', result, '===');
      return result;
    },
    async session({ session, token, user }) {
      console.log("=== SESSION CALLBACK START ===");
      const useremail = session?.user?.email;

      if (session && user?.email === useremail) {
        try {
          // const response = await axios.get(
          //   `${process.env.NEXTAUTH_URL}/api/auth/user_session?email=${useremail}`, {
          //headers: {
          //  "x-api-key": process.env.API_ACCESS_KEY,
          // },
          //}
          // );
          // session.user = response.data;
          const response = await getUserId(user?.id);
          session.user.id = response?.id;
          session.user.name = response?.name;
          session.user.email = response?.email;
          session.user.image = response?.image;
          session.user.pen_name = response?.pen_name;
          session.user.cover_image = response?.cover_image;
          session.user.color = response?.color;
          session.user.role = response?.role;
          session.user.crowdpen_staff = response?.crowdpen_staff;
          session.user.merchant = response?.merchant;
        } catch (error) {
          console.log("session oauth error..............", error);
        }
      }
      return session;
    },

    async redirect({ url, baseUrl }) {
      console.log("NextAuth redirect callback with:", { url, baseUrl });

      // Always use the absolute URL from environment variables if available
      const effectiveBaseUrl = process.env.NEXTAUTH_URL || baseUrl;

      // Allow callback URLs on the same origin
      if (url.startsWith(effectiveBaseUrl)) {
        return url;
      }

      try {
        const urlOrigin = new URL(url).origin;
        const baseOrigin = new URL(effectiveBaseUrl).origin;
        if (urlOrigin === baseOrigin) {
          return url;
        }
      } catch (e) {
        // ignore parsing errors for relative or invalid URLs
      }

      // If URL starts with '?', it's a query string relative to base
      if (url.startsWith("?")) {
        return `${effectiveBaseUrl}${url}`;
      }

      // Handle relative URLs
      if (url.startsWith("/")) {
        return `${effectiveBaseUrl}${url}`;
      }

      // Allow known Crowdpen domain redirects (for logout or errors)
      const crowdpenUrl = process.env.CROWDPEN_URL || "https://crowdpen.co";
      if (url.startsWith(crowdpenUrl) || url.includes("crowdpen.co")) {
        return url;
      }

      // Default: return base URL
      return effectiveBaseUrl;
    },
  },
  debug: process.env.NODE_ENV === "development",
  secret: process.env.NEXTAUTH_SECRET,
};

const handler = NextAuth(authOptions);

export { handler as GET, handler as POST };
