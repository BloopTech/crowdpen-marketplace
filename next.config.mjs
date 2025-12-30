/** @type {import('next').NextConfig} */
const isDev = process.env.NODE_ENV === "development";

let r2PublicHost;
try {
  const raw = process.env.CLOUDFLARE_R2_PUBLIC_URL;
  if (raw) {
    r2PublicHost = new URL(raw).hostname;
  }
} catch {
  r2PublicHost = undefined;
}

const csp = [
  "default-src 'self'",
  "base-uri 'self'",
  "font-src 'self' https: data:",
  "img-src 'self' data: blob: https:",
  "object-src 'none'",
  // Allow GA/Tag Manager and inline scripts (Next.js inline snippets). 'unsafe-eval' for dev HMR only.
  `script-src 'self' https://www.googletagmanager.com https://www.google-analytics.com https://crowdpen-marketplace.vercel.app https://marketplace.crowdpen.co ${isDev ? "'unsafe-inline' 'unsafe-eval'" : "'unsafe-inline'"}`,
  "style-src 'self' 'unsafe-inline'",
  "connect-src 'self' https: wss: ws:",
  "frame-ancestors 'none'",
  "form-action 'self'",
  "upgrade-insecure-requests",
].join("; ");

const nextConfig = {
  turbopack: (config, { isServer }) => {
    // Ignore sequelize dynamic import warnings
    config.ignoreWarnings = [
      { module: /sequelize/ },
    ];
    return config;
  },
  experimental: {
    serverActions: {
      bodySizeLimit: '40mb',
    },
  },
  reactStrictMode: true,
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), interest-cohort=()" },
        ],
      },
    ];
  },
  images: {
    remotePatterns: [
      {
        protocol: "http",
        hostname: "localhost",
      },
      ...(r2PublicHost
        ? [
            {
              protocol: "https",
              hostname: r2PublicHost,
            },
          ]
        : []),
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
