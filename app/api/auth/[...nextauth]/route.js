import NextAuth from "next-auth";
import SequelizeAdapter from "@auth/sequelize-adapter";
//import { sequelize } from "../../../../db/models";
import sequelize from "../../../models/database";
//import { getUserId } from "../../../../cacher";
import Email from "next-auth/providers/email";
import GitHub from "next-auth/providers/github";
import Google from "next-auth/providers/google";
import CredentialsProvider from "next-auth/providers/credentials";
import { getUserId } from "../../../cacher";
import sendVerificationRequest from "../../../lib/EmailVerification";
import axios from 'axios';
import { cookies } from "next/headers";

// Determine the absolute URL for the app
const absoluteUrl = process.env.NEXTAUTH_URL || process.env.NEXT_PUBLIC_NEXTAUTH_URL || 'http://localhost:3000';
console.log('NextAuth using absolute URL:', absoluteUrl);

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
    // Regular credentials provider for email login
    CredentialsProvider({
      id: "credentials",
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "email" },
      },
      async authorize(credentials) {
        if (!credentials?.email) {
          return null;
        }

        try {
          // Find the user in the database with the email
          const user = await sequelize.models.User.findOne({
            where: { email: credentials.email.toLowerCase() }
          });

          if (!user) {
            return null;
          }

          // Return the user object which will be saved in the JWT token
          return {
            id: user.id,
            email: user.email,
            name: user.name,
            image: user.image
          };
        } catch (error) {
          console.error("Credentials authorize error:", error);
          return null;
        }
      },
    }),
    // Add a custom provider for Crowdpen SSO
    // This provider will check if a token from Crowdpen is valid
    // and authenticate the user accordingly
    CredentialsProvider({
      id: "crowdpen",
      name: "Crowdpen",
      async authorize(credentials, req) {
        try {
          console.log('Authorizing Crowdpen credentials:', credentials?.token ? 'Token provided' : 'No token');
          const { token } = credentials;
          
          if (!token) {
            console.error('No token provided for Crowdpen auth');
            throw new Error('No token provided');
          }

          let decodedToken;
          
          try {
            // JWT tokens are signed with the same secret as this app
            // We can verify them directly
            decodedToken = jwt.verify(token, process.env.NEXTAUTH_SECRET);
            
            // Check if the token is valid and has the right structure
            if (!decodedToken.email) {
              console.error('Invalid token format');
              throw new Error('Invalid token format');
            }
            
            console.log('Successfully verified token for:', decodedToken.email);
          } catch (verifyError) {
            console.error('Local token verification failed:', verifyError);
            
            // If local verification fails, try to verify with Crowdpen directly
            console.log('Attempting to verify token with Crowdpen directly...');
            try {
              // Call the Crowdpen verification endpoint
              // Use environment variable or default for Crowdpen URL
              const crowdpenUrl = process.env.NEXT_PUBLIC_CROWDPEN_URL || 'https://crowdpen.co';
              console.log('Using Crowdpen URL:', crowdpenUrl);
              
              const verifyResponse = await axios.post(
                `${crowdpenUrl}/api/auth/verify-sso-token`,
                { token },
                {
                  headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json'
                  },
                  withCredentials: true // Important for cross-domain cookie sharing
                },
              );
              
              const verifyResult = verifyResponse.data;
              
              if (verifyResult.error || !verifyResult.user) {
                console.error('Crowdpen verification failed:', verifyResult.error || 'No user returned');
                throw new Error('Token verification with Crowdpen failed');
              }
              
              console.log('Successfully verified token with Crowdpen API for:', verifyResult.user.email);
              decodedToken = {
                email: verifyResult.user.email,
                name: verifyResult.user.name,
                image: verifyResult.user.image,
                id: verifyResult.user.id
              };
            } catch (apiError) {
              console.error('Crowdpen API verification error:', apiError);
              throw new Error(`Token verification failed: ${apiError.message}`);
            }
          }
          
          // At this point we have a valid decodedToken
          // Find the user in the database or create them
          try {          
            // Since Crowdpen and Crowdpen-Marketplace share the same database,
            // we can look up the user by email
            const user = await prisma.user.findUnique({
              where: { email: decodedToken.email },
            });
            
            if (user) {
              console.log('Found existing user:', user.id);
              
              // Update user data if needed
              if ((decodedToken.name && user.name !== decodedToken.name) ||
                  (decodedToken.image && user.image !== decodedToken.image)) {
                console.log('Updating user data from token');
                await prisma.user.update({
                  where: { id: user.id },
                  data: {
                    name: decodedToken.name || user.name,
                    image: decodedToken.image || user.image,
                  },
                });
              }
              
              return user;
            }
            
            // If the user doesn't exist in our database yet,
            // create a new one based on the token data
            console.log('Creating new user from Crowdpen data');
            
            const newUser = await prisma.user.create({
              data: {
                email: decodedToken.email,
                name: decodedToken.name || '',
                image: decodedToken.image || '',
              },
            });
            
            return newUser;
          } catch (dbError) {
            console.error('Database error during user lookup/creation:', dbError);
            throw new Error(`Database error: ${dbError.message}`);
          }
        } catch (error) {
          console.error('Crowdpen authentication error:', error);
          throw new Error(`Authentication failed: ${error.message}`);
        }
      },
    }),
    
  ],

  adapter: SequelizeAdapter(sequelize),
  pages: {
    // Don't override the signIn page - let NextAuth handle it locally
    //signOut: "/auth/signout",
    //error: "/auth/error", // Error code passed in query string as ?error=
    verifyRequest: `https://crowdpen.co/verify-request`, // (used for check email message)
    newUser: "https://crowdpen.co/new-user", // New users will be directed here on first sign in (leave the property out if not of interest)
  },
  callbacks: {
    // Add token callback to include user data in JWT for Crowdpen SSO
    async jwt({ token, user, account }) {
      // If the user just signed in, add their data to the token
      if (user) {
        token.id = user.id;
        token.email = user.email;
        token.name = user.name;
        token.image = user.image;
        token.provider = account?.provider;
      }
      return token;
    },
    
    async session({ session, token, user }) {
      // For JWT sessions
      if (token && !user) {
        session.user = session.user || {};
        session.user.id = token.id;
        session.user.name = token.name;
        session.user.email = token.email;
        session.user.image = token.image;
      }
      
      const useremail = session?.user?.email;
      
      if (session && user?.email === useremail) {
        try {
          const response = await getUserId(user?.id);

          session.user.lastLoginDate = response?.lastLoginDate || null;
          session.user.loginStreak = response?.loginStreak || null;
          session.user.totalPoints = response?.totalPoints || null;
          session.user.dob = response?.dob || null;
          session.user.id = response?.id;
          session.user.name = response?.name;
          session.user.email = response?.email;
          session.user.image = response?.image;
          session.user.pen_name = response?.pen_name;
          session.user.cover_image = response?.cover_image;
          session.user.creator = response?.creator;
          session.user.verification_badge = response?.verification_badge;
          session.user.subscribed = response?.subscribed;
          session.user.stories_for_you = response?.stories_for_you;
          session.user.role = response?.role;
          session.user.stripe_customer_id = response?.stripe_customer_id;
          session.user.paystack_customer_id = response?.paystack_customer_id;
          session.user.color = response?.color;
          session.user.username = response?.username;
          session.user.subscribed_via = response?.subscribed_via;
          session.user.subscribed_date = response?.subscribed_date;
          session.user.crowdpen_staff = response?.crowdpen_staff;
          session.user.paystack_customer_code = response?.paystack_customer_code;
          // Add any other user properties you want to include
        } catch (error) {
          console.log("Session enhancement error:", error);
        }
      }
      return session;
    },
    
    async redirect({ url, baseUrl }) {
       console.log('NextAuth redirect callback with:', { url, baseUrl });
       
       // Always use the absolute URL from environment variables if available
       const effectiveBaseUrl = process.env.NEXTAUTH_URL || process.env.NEXT_PUBLIC_NEXTAUTH_URL || baseUrl;

       // If URL starts with '?', it's a query string relative to base
       if (url.startsWith('?')) {
         return `${effectiveBaseUrl}${url}`;
       }

       // Handle relative URLs
       if (url.startsWith('/')) {
         return `${effectiveBaseUrl}${url}`;
       }

       // Allow known Crowdpen domain redirects (for logout or errors)
       const crowdpenUrl = process.env.NEXT_PUBLIC_CROWDPEN_URL || 'https://crowdpen.co';
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

export const handler = NextAuth(authOptions);

export { handler as GET, handler as POST };
