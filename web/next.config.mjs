/** @type {import('next').NextConfig} */
const nextConfig = {
  // wagmi / walletconnect / metamask-sdk pull in optional deps (React Native,
  // logging) that aren't needed on web — stub them so they don't warn/break.
  webpack: (config) => {
    config.externals.push("pino-pretty", "lokijs", "encoding");
    config.resolve.fallback = {
      ...config.resolve.fallback,
      "@react-native-async-storage/async-storage": false,
    };
    return config;
  },
};

export default nextConfig;
