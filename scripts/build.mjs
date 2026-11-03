import { build } from "esbuild";
import { readFileSync, existsSync, readdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
await build({
  entryPoints: ["desktop/source.tsx"],
  outfile: "desktop/plugin.js",
  bundle: true,
  format: "esm",
  platform: "browser",
  target: "chrome120",
  external: ["react", "react/jsx-runtime", "@hermes/plugin-sdk"],
  sourcemap: false,
});
const result = await build({
  entryPoints: ["src/index.ts"],
  outfile: "dist/server.mjs",
  bundle: true,
  format: "esm",
  platform: "node",
  target: "node24",
  metafile: true,
  banner: {
    js: "import {createRequire} from 'node:module'; const require = createRequire(import.meta.url);",
  },
});
const packages = new Set();
for (const file of Object.keys(result.metafile.inputs)) {
  if (!file.includes("node_modules/")) continue;
  let folder = dirname(file);
  while (folder !== ".") {
    const path = join(folder, "package.json");
    if (existsSync(path) && JSON.parse(readFileSync(path, "utf8")).name) break;
    folder = dirname(folder);
  }
  packages.add(folder);
}
const notices = ["Third-party packages bundled in dist/server.mjs.\n"];
for (const folder of [...packages].sort()) {
  const pkg = JSON.parse(readFileSync(join(folder, "package.json"), "utf8"));
  const license = readdirSync(folder).find((f) =>
    /^licen[sc]e(?:\.|$)/i.test(f),
  );
  if (!license) throw Error(`Missing bundled license: ${pkg.name}`);
  notices.push(
    `\n--- ${pkg.name} ${pkg.version} (${pkg.license}) ---\n\n` +
      readFileSync(join(folder, license), "utf8"),
  );
}
writeFileSync("THIRD_PARTY_NOTICES.txt", notices.join("\n"));
