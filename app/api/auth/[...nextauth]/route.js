import NextAuth from "next-auth";
import SequelizeAdapter from "@auth/sequelize-adapter";
//import { sequelize } from "../../../../db/models";
import sequelize from "../../../models/database";
//import { getUserId } from "../../../../cacher";
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
console.log('NextAuth using absolute URL:', absoluteUrl);

// Helper function for SSO user data authentication
async function handleUserData(userData) {
  try {
    console.log('=== SSO USER DATA AUTH START ===');
    console.log('User data provided:', userData ? 'YES' : 'NO');
    
    if (!userData) {
      console.error('No user data provided for SSO auth');
      return null;
    }

    // Parse user data if it's a string
    let parsedUserData;
    if (typeof userData === 'string') {
      try {
        // First decode URL-encoded data, then parse JSON
        const decodedData = decodeURIComponent(userData);
        console.log('Decoded user data:', decodedData);
        parsedUserData = JSON.parse(decodedData);
      } catch (parseError) {
        console.error('Failed to parse user data:', parseError);
        console.error('Raw user data:', userData);
        return null;
      }
    } else {
      parsedUserData = userData;
    }
    
    console.log('Parsed user data:', parsedUserData);
    
    if (!parsedUserData.email) {
      console.error('No email in user data');
      return null;
    }
    
    // Since both apps share the same database, look up the user directly
    const user = await sequelize.models.User.findOne({
      where: { email: parsedUserData.email },
    });
    
    if (user) {
      console.log('Found existing user in shared database:', user.id);
      
      // Update user data if needed from Crowdpen
      if ((parsedUserData.name && user.name !== parsedUserData.name) ||
          (parsedUserData.image && user.image !== parsedUserData.image)) {
        console.log('Updating user data from Crowdpen SSO');
        await sequelize.models.User.update({
          name: parsedUserData.name || user.name,
          image: parsedUserData.image || user.image,
        }, {
          where: { id: user.id },
        });
      }
      
      console.log('=== SSO AUTHORIZE SUCCESS - EXISTING USER ===');
      return user;
    }
    
    // If the user doesn't exist in our shared database yet,
    // create a new one based on the Crowdpen data
    console.log('Creating new user from Crowdpen SSO data in shared database');
    
    const newUser = await sequelize.models.User.create({
      email: parsedUserData.email,
      name: parsedUserData.name || '',
      image: parsedUserData.image || '',
    });
    
    console.log('=== SSO AUTHORIZE SUCCESS - NEW USER ===');
    return newUser;
    
  } catch (error) {
    console.error('=== SSO USER DATA AUTH ERROR ===', error);
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
      where: { email: email.toLowerCase() }
    });

    if (!user) {
      return null;
    }

    return {
      id: user.id,
      email: user.email,
      name: user.name,
      image: user.image
    };
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
      //allowDangerousEmailAccountLinking: true,
      httpOptions: {
        timeout: 40000,
      },
    }),
    // Unified credentials provider for both email and token authentication
    CredentialsProvider({
      id: "credentials",
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        user: { label: "User Data", type: "text" },
      },
      async authorize(credentials) {
        console.log('=== CREDENTIALS PROVIDER AUTHORIZE START ===');
        console.log('Credentials received:', {
          hasUser: !!credentials?.user,
          hasEmail: !!credentials?.email,
          userDataLength: credentials?.user?.length || 0
        });
        
        // Handle SSO user data authentication
        if (credentials?.user) {
          console.log('Processing SSO user data authentication');
          const result = await handleUserData(credentials.user);
          console.log('SSO auth result:', result ? 'SUCCESS' : 'FAILED');
          return result;
        }
        
        // Handle email-based authentication
        if (credentials?.email) {
          console.log('Processing email authentication');
          const result = await handleEmailAuth(credentials.email);
          console.log('Email auth result:', result ? 'SUCCESS' : 'FAILED');
          return result;
        }
        
        console.log('=== CREDENTIALS PROVIDER AUTHORIZE - NO VALID CREDENTIALS ===');
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
    signIn: "/login",
    //signOut: "/auth/signout",
    //error: "/auth/error", // Error code passed in query string as ?error=
    verifyRequest: `/verify-request`, // (used for check email message)
    newUser: "/new-user", // New users will be directed here on first sign in (leave the property out if not of interest)
  },
  callbacks: {
    async session({ session, token, user }) {
      console.log('=== SESSION CALLBACK START ===');
      console.log('Session callback inputs:', {
        hasSession: !!session,
        hasToken: !!token,
        hasUser: !!user,
        userEmail: user?.email || 'N/A'
      });
      
      // For database sessions, user object is available directly
      if (session && user) {
        session.user.id = user.id;
        session.user.name = user.name;
        session.user.email = user.email;
        session.user.image = user.image;
        
        console.log('=== SESSION CREATED SUCCESSFULLY ===');
        console.log('Session user:', user.email);
        return session;
      }
      
      console.log('=== SESSION CALLBACK - NO USER DATA AVAILABLE ===');
      console.log('This indicates session creation failed');
      return session;
    },
    
    async redirect({ url, baseUrl }) {
       console.log('NextAuth redirect callback with:', { url, baseUrl });
       
       // Always use the absolute URL from environment variables if available
       const effectiveBaseUrl = process.env.NEXTAUTH_URL || baseUrl;

       // If URL starts with '?', it's a query string relative to base
       if (url.startsWith('?')) {
         return `${effectiveBaseUrl}${url}`;
       }

       // Handle relative URLs
       if (url.startsWith('/')) {
         return `${effectiveBaseUrl}${url}`;
       }

       // Allow known Crowdpen domain redirects (for logout or errors)
       const crowdpenUrl = process.env.CROWDPEN_URL || 'https://crowdpen.co';
       if (url.startsWith(crowdpenUrl) || url.includes('crowdpen.co')) {
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
