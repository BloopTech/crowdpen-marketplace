/** @type {import('next').NextConfig} */
const nextConfig = {
  webpack: (config, { isServer }) => {
    // Ignore sequelize dynamic import warnings
    config.ignoreWarnings = [
      { module: /sequelize/ },
    ];
    return config;
  },
  experimental: {
    serverActions: {
      bodySizeLimit: '10mb',
    },
  },
  reactStrictMode: true,
  env: {
    NEXTAUTH_URL: process.env.NEXTAUTH_URL,
    NEXT_PUBLIC_NEXTAUTH_URL: process.env.NEXT_PUBLIC_NEXTAUTH_URL,
    API_ACCESS_KEY: process.env.API_ACCESS_KEY,
    API_ENCRYPTION_IV: process.env.API_ENCRYPTION_IV,
    API_ENCRYPTION_KEY: process.env.API_ENCRYPTION_KEY,
    DB_PORT: process.env.DB_PORT,
    DB_USERNAME: process.env.DB_USERNAME,
    DB_PASSWORD: process.env.DB_PASSWORD,
    DB_DATABASE: process.env.DB_DATABASE,
    DB_HOST: process.env.DB_HOST,
    DB_DIALECT: process.env.DB_DIALECT,
    DB_URL: process.env.DB_URL,
    GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID,
    GOOGLE_CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET,
    GITHUB_CLIENT_ID: process.env.GITHUB_CLIENT_ID,
    GITHUB_SECRET_ID: process.env.GITHUB_SECRET_ID,
    OFFICE365_CLIENT_ID: process.env.OFFICE365_CLIENT_ID,
    OFFICE365_CLIENT_SECRET: process.env.OFFICE365_CLIENT_SECRET,
    OFFICE365_TENANT_ID: process.env.OFFICE365_TENANT_ID,
    OFFICE365_USERNAME: process.env.OFFICE365_USERNAME,
    EMAIL_SERVER_HOST: process.env.EMAIL_SERVER_HOST,
    EMAIL_SERVER_USER: process.env.EMAIL_SERVER_USER,
    EMAIL_FROM: process.env.EMAIL_FROM,
    EMAIL_SERVER_PASSWORD: process.env.EMAIL_SERVER_PASSWORD,
    EMAIL_SERVER_PORT: process.env.EMAIL_SERVER_PORT,
    CLOUDFLARE_R2_ACCESS_KEY_ID: process.env.CLOUDFLARE_R2_ACCESS_KEY_ID,
    CLOUDFLARE_R2_SECRET_ACCESS_KEY: process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY,
    CLOUDFLARE_R2_ENDPOINT: process.env.CLOUDFLARE_R2_ENDPOINT,
    CLOUDFLARE_R2_PUBLIC_URL: process.env.CLOUDFLARE_R2_PUBLIC_URL,
    CLOUDFLARE_R2_BUCKET_NAME: process.env.CLOUDFLARE_R2_BUCKET_NAME,
    CLOUDFLARE_R2_TOKEN_VALUE: process.env.CLOUDFLARE_R2_TOKEN_VALUE,
  },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "**",
      },
      {
        protocol: "http",
        hostname: "localhost",
      },
      {
        protocol: "https",
        hostname: "res.cloudinary.com",
      },
      {
        protocol: "https",
        hostname: "images.unsplash.com",
      },
      {
        protocol: "https",
        hostname: "plus.unsplash.com",
      },
      {
        protocol: "https",
        hostname: "tenor.com",
      },
      {
        protocol: "https",
        hostname: "media.tenor.com",
      },
      {
        protocol: "https",
        hostname: "lh3.googleusercontent.com",
      },
      {
        protocol: "https",
        hostname: "crowdpen-bucket.s3.us-east-1.amazonaws.com",
      },
      {
        protocol: "https",
        hostname: "avatars.githubusercontent.com",
      },
      {
        protocol: "https",
        hostname: "crowdpen-bucket.s3.amazonaws.com",
      },
      {
        protocol: "https",
        hostname: "bloopglobalhub.sharepoint.com",
      },
      {
        protocol: "https",
        hostname: "bloopglobalhub-my.sharepoint.com",
      },
      {
        protocol: "https",
        hostname: "crowdpen.site",
      },
    ],
  },
};

export default nextConfig;
