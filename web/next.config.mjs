/** @type {import('next').NextConfig} */
const securityHeaders = [
  { key: "X-Frame-Options", value: "DENY" },
  {
    key: "Content-Security-Policy",
    value: "frame-ancestors 'none'; base-uri 'self'; object-src 'none'",
  },
  {
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains; preload",
  },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  {
    key: "Permissions-Policy",
    value: "geolocation=(), camera=(), microphone=(), payment=()",
  },
];

const nextConfig = {
  poweredByHeader: false,
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
  // wagmi / walletconnect / metamask-sdk pull in optional deps (React Native,
  // logging) that aren't needed on web — stub them so they don't warn/break.
  webpack: (config, { webpack }) => {
    config.externals.push("pino-pretty", "lokijs", "encoding");
    config.resolve.fallback = {
      ...config.resolve.fallback,
      "@react-native-async-storage/async-storage": false,
    };
    // @wagmi/connectors' Base Account connector pulls in @coinbase/cdp-sdk,
    // which imports optional @x402/* packages (a2a payments). We only use the
    // injected() connector, so that code path never runs — ignore the missing
    // modules so the barrel import doesn't fail the build.
    config.plugins.push(
      new webpack.IgnorePlugin({ resourceRegExp: /^@x402\// }),
    );
    return config;
  },
};

export default nextConfig;
