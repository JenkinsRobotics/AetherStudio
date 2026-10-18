import viteConfig from "./vite.config";

export default {
  ...viteConfig,
  // Match the other app consumers: the shared transport exposes TypeScript.
  test: {
    server: { deps: { inline: [/@aether\//] } },
    include: ["src/**/*.test.{ts,tsx}"],
  },
};
