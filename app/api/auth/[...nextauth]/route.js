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

// Determine the absolute URL for the app
const absoluteUrl = process.env.NEXTAUTH_URL;
console.log("NextAuth using absolute URL:", absoluteUrl);

// Helper function for SSO user data authentication
export async function handleUserData(userData) {
  try {
    console.log("=== SSO USER DATA AUTH START ===");
    console.log("User data provided:", userData ? "YES" : "NO");

    if (!userData) {
      console.error("No user data provided for SSO auth");
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
        console.error("Failed to parse user data:", parseError);
        console.error("Raw user data:", userData);
        return null;
      }
    } else {
      parsedUserData = userData;
    }

    //console.log('Parsed user data:', parsedUserData);

    if (!parsedUserData.email) {
      console.error("No email in user data");
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
    console.error("=== SSO USER DATA AUTH ERROR ===", error);
    return null;
  }
}

// Helper function for email-based authentication
async function handleEmailAuth(email) {
  if (!email) {
    return null;
  }

  try {
    const user = await sequelize.models.User.findOne({
      where: { email: email.toLowerCase() },
    });

    if (!user) {
      return null;
    }

    const returnUser = {
      id: user.id,
      email: user.email,
      name: user.name,
      image: user.image,
    };

    console.log("=== HANDLEUSERDATA RETURNING USER ===");
    //console.log('Returning user:', returnUser);
    return returnUser;
  } catch (error) {
    console.error("Email auth error:", error);
    return null;
  }
}

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

    // Regular email credentials provider
    CredentialsProvider({
      id: "email-credentials",
      name: "Email Credentials",
      credentials: {
        email: { label: "Email", type: "email" },
      },
      async authorize(credentials) {
        console.log("=== EMAIL CREDENTIALS AUTHORIZE START ===");

        if (credentials?.email) {
          console.log("Processing email authentication");
          const result = await handleEmailAuth(credentials.email);
          //console.log('Email auth result:', result);
          return result;
        }

        console.log("=== EMAIL CREDENTIALS AUTHORIZE - NO EMAIL ===");
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
          console.error("ERROR: User email is missing in OAuth callback");
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
          console.error("Error validating OAuth user in database:", error);
          // Don't fail the sign-in for database errors, let NextAuth handle it
        }
      }

      const result = true;
      //console.log('=== SIGNIN CALLBACK RESULT:', result, '===');
      return result;
    },
    async session({ session, token, user }) {
      console.log("=== SESSION CALLBACK START ===");
      // console.log('Session callback inputs:', {
      //   hasSession: !!session,
      //   hasToken: !!token,
      //   hasUser: !!user,
      //   userEmail: user?.email || token?.email || 'N/A',
      //   sessionStrategy: 'database'
      // });
      // console.log('Session user..............', user, session, token);
      // For database sessions, user object is available directly
      if (session && user) {
        session.user.id = user.id;
        session.user.name = user.name;
        session.user.email = user.email;
        session.user.image = user.image;

        console.log("=== DATABASE SESSION CREATED SUCCESSFULLY ===");
        //console.log('Session user:', user.email);
        return session;
      }

      // Handle JWT fallback case (credentials provider)
      if (session && token && !user) {
        console.log("=== JWT SESSION DETECTED - CONVERTING TO DATABASE ===");

        // Get user from database using token data
        try {
          const dbUser = await getUserId(token.sub || token.id);
          if (dbUser) {
            session.user.id = dbUser.id;
            session.user.name = dbUser.name;
            session.user.email = dbUser.email;
            session.user.image = dbUser.image;

            console.log("=== JWT TO DATABASE SESSION CONVERSION SUCCESS ===");
            //console.log('Converted session user:', dbUser.email);
            return session;
          }
        } catch (error) {
          console.error("Failed to convert JWT to database session:", error);
        }
      }

      console.log("=== SESSION CALLBACK - NO USER DATA AVAILABLE ===");
      console.log("This indicates session creation failed");
      return session;
    },

    async redirect({ url, baseUrl }) {
      console.log("NextAuth redirect callback with:", { url, baseUrl });

      // Always use the absolute URL from environment variables if available
      const effectiveBaseUrl = process.env.NEXTAUTH_URL || baseUrl;

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
