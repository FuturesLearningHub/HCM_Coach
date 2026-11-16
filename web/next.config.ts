import path from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Do not let `next dev` write an AGENTS.md into the workspace.
  agentRules: false,
  devIndicators: false,
  // npm workspace: the lockfile and node_modules live one level up.
  turbopack: { root: path.resolve(__dirname, "..") },
  outputFileTracingRoot: path.resolve(__dirname, ".."),
};

export default nextConfig;
