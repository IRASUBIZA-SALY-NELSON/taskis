import type { NextConfig } from "next";

const onVercel = process.env.VERCEL === "1";
const configured = (process.env.BACKEND_URL || "").replace(/\/$/, "");

function isPrivateOrigin(url: string) {
    try {
        const host = new URL(url).hostname;
        return (
            host === "localhost" ||
            host === "127.0.0.1" ||
            host.endsWith(".local") ||
            /^(10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(host)
        );
    } catch {
        return true;
    }
}

// Local dev can proxy to this machine. Vercel cannot — it rejects private
// destinations with DNS_HOSTNAME_RESOLVED_PRIVATE.
const backend = configured || (onVercel ? "https://taskis-api.onrender.com" : "http://127.0.0.1:8080");
const canProxy = Boolean(backend) && !(onVercel && isPrivateOrigin(backend));

const nextConfig: NextConfig = {
    allowedDevOrigins: ['10.12.75.200', 'localhost'],
    async rewrites() {
        if (!canProxy) return [];
        return [
            { source: '/api/:path*', destination: `${backend}/api/:path*` },
            { source: '/ws', destination: `${backend}/ws` },
            { source: '/ws/:path*', destination: `${backend}/ws/:path*` },
            { source: '/uploads/:path*', destination: `${backend}/uploads/:path*` },
        ];
    },
};

export default nextConfig;
