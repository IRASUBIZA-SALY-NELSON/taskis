import type { NextConfig } from "next";

const backend = (process.env.BACKEND_URL || "http://127.0.0.1:8080").replace(/\/$/, "");

const nextConfig: NextConfig = {
    allowedDevOrigins: ['10.12.75.200', 'localhost'],
    async rewrites() {
        return [
            { source: '/api/:path*', destination: `${backend}/api/:path*` },
            { source: '/ws', destination: `${backend}/ws` },
            { source: '/ws/:path*', destination: `${backend}/ws/:path*` },
            { source: '/uploads/:path*', destination: `${backend}/uploads/:path*` },
        ];
    },
};

export default nextConfig;
