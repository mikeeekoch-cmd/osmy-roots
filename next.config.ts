import type { NextConfig } from "next";
const config: NextConfig = { distDir: process.env.ROOTS_NEXT_DIST || ".next", agentRules: false, devIndicators: false };
export default config;
