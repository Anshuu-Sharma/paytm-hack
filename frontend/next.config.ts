import type { NextConfig } from "next";
import path from "node:path";

const nextConfig: NextConfig = {
  // R3F creates a WebGL context on mount and calls forceContextLoss() on
  // unmount. React StrictMode double-invokes mount/unmount in dev, which tears
  // down and loses the context (particles flash then vanish with
  // "THREE.WebGLRenderer: Context Lost"). Disable the dev double-invoke.
  reactStrictMode: false,

  // Pin the workspace root so Turbopack ignores stray lockfiles higher up the
  // filesystem (e.g. ~/package-lock.json) and treats this app dir as the root.
  turbopack: {
    root: path.join(__dirname),
  },
};

export default nextConfig;
