// esbuild.js
const { build } = require("esbuild");
build({
  entryPoints: ["extension.js"],
  bundle: true,
  platform: "node",
  external: ["vscode"], // vscode API is not bundled
  outfile: "dist/extension.js",
  sourcemap: true,
}).catch(() => process.exit(1));
