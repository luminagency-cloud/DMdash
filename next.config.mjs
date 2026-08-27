/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Vercel creates its own deployment output. Standalone output is for
  // another Node.js host or a container.
  ...(process.env.VERCEL ? {} : { output: 'standalone' }),
};

export default nextConfig;
