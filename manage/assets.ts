import { createAssetServer } from "remix/assets";
import { isDevelopment } from "./env.ts";

export const assets = createAssetServer({
  basePath: "/assets",
  rootDir: process.cwd(),
  mounts: { manage: "manage", npm: "node_modules" },
  // Only files under a public/ directory are reachable from the browser
  allowFiles: ["manage/routes.ts", "manage/**/public/**"],
  allowPackages: ["remix"],
  files: { extensions: [".woff2"] },
  fingerprint: !isDevelopment,
  sourceMaps: isDevelopment ? "external" : undefined,
  minify: !isDevelopment,
  watch: isDevelopment,
});

export const scriptEntry = await assets.getScriptEntry("manage/actions/public/entry.ts");
export const stylesheetHref = await assets.getHref("manage/ui/public/app.css");
