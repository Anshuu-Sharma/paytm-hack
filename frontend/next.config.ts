import type { NextConfig } from "next";
import path from "node:path";

const nextConfig: NextConfig = {
  // R3F creates a WebGL context on mount and calls forceContextLoss() on
  // unmount. React StrictMode double-invokes mount/unmount in dev, which tears
  // down and loses the context (particles flash then vanish with
  // "THREE.WebGLRenderer: Context Lost"). Disable the dev double-invoke.
  reactStrictMode: false,

  // Dev-mode origin check blocks requests whose Host doesn't match localhost
  // (DNS-rebinding protection) — this demo is tunneled through ngrok for
  // judges, so its hostname needs to be explicitly allowed or static chunks
  // and the HMR websocket get a 403.
  allowedDevOrigins: ["theodore-nonemulous-treva.ngrok-free.dev"],

  // Pin the workspace root so Turbopack ignores stray lockfiles higher up the
  // filesystem (e.g. ~/package-lock.json) and treats this app dir as the root.
  turbopack: {
    root: path.join(__dirname),
  },
};

export default nextConfig;
