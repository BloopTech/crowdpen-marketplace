import NextAuth from "next-auth";
import SequelizeAdapter from "@auth/sequelize-adapter";
//import { sequelize } from "../../../../db/models";
import sequelize from "../../../models";
//import { getUserId } from "../../../../cacher";
import Email from "next-auth/providers/email";
import GitHub from "next-auth/providers/github";
import Google from "next-auth/providers/google";
import CredentialsProvider from "next-auth/providers/credentials";
import { getUserId } from "../../../cacher";
import sendVerificationRequest from "../../../lib/EmailVerification";

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
    // Add credentials provider for Crowdpen SSO
    CredentialsProvider({
      id: "credentials",
      name: "Crowdpen",
      credentials: {
        email: { label: "Email", type: "email" },
      },
      async authorize(credentials) {
        if (!credentials?.email) {
          return null;
        }

        try {
          // Find the user in the database with the email from Crowdpen
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
  ],

  adapter: SequelizeAdapter(sequelize),
  pages: {
    // Don't override the signIn page - let NextAuth handle it locally
    //signOut: "/auth/signout",
    //error: "/auth/error", // Error code passed in query string as ?error=
    verifyRequest: `https://crowdpen.co/verify-request`, // (used for check email message)
    newUser: "https://crowdpen.co/new-user", // New users will be directed here on first sign in (leave the property out if not of interest)
  },
  adapter: SequelizeAdapter(sequelize),
  callbacks: {
    async session({ session, token, user }) {
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
          session.user.referralCode = response?.referralCode;
          session.user.want_crowdpen_emails = response?.want_crowdpen_emails;
          session.user.want_crowdpen_emails = response?.want_crowdpen_emails;
          session.user.want_notify_emails = response?.want_notify_emails;
          session.user.subscription_current_period_end =
            response?.subscription_current_period_end;

        } catch (error) {
          console.log("session oauth error..............", error);
        }
      }
      return session;
    },
    // async session({ session, token }) {
    //   if (token && session.user) {
    //     session.user.id = token.id ?? null;
    //   }
    //   return session;
    // },
    async redirect({ url, baseUrl }) {
      // Allows relative callback URLs

      // if (url.startsWith("/")) return `${baseUrl}${url}`;
      // // Allows callback URLs on the same origin
      // else if (new URL(url).origin === baseUrl) return url;
      // return baseUrl;
      try {
        // If URL starts with "?", it's a query string (like "?referralCode=xyz")
        if (url.startsWith("?")) {
          return `${baseUrl}${url}`;
        }

        // Handle relative URLs
        if (url.startsWith("/")) {
          return `${baseUrl}${url}`;
        }

        // Handle absolute URLs from the same origin
        if (new URL(url, baseUrl).origin === baseUrl) {
          return url;
        }
        return baseUrl;
      } catch (error) {
        console.error("Redirect error:", error);
        return baseUrl;
      }
    },
  },
  debug: process.env.NODE_ENV === "development",
  secret: process.env.NEXTAUTH_SECRET,
};

export const handler = NextAuth(authOptions);

export { handler as GET, handler as POST };
