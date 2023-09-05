import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { rollup } from "rollup";
import { nodeResolve } from "@rollup/plugin-node-resolve";
import commonjs from "@rollup/plugin-commonjs";
import json from "@rollup/plugin-json";

const files = fileURLToPath(new URL("./files", import.meta.url).href);

/** @type {import('.').default} */
export default function (opts = {}) {
  const { out = "build", precompress, envPrefix = "", polyfill = true } = opts;

  return {
    name: "adapter-node",

    async adapt(builder) {
      const tmp = builder.getBuildDirectory("adapter-node");

      builder.rimraf(out);
      builder.rimraf(tmp);
      builder.mkdirp(tmp);

      builder.log.minor("Copying assets");
      builder.writeClient(`${out}/client${builder.config.paths.base}`);

      if (precompress) {
        builder.log.minor("Compressing assets");
        await builder.compress(`${out}/client`);
      }

      builder.log.minor("Building server");

      builder.writeServer(tmp);

      const pkg = JSON.parse(readFileSync("package.json", "utf8"));

      // we bundle the Vite output so that deployments only need
      // their production dependencies. Anything in devDependencies
      // will get included in the bundled code
      const bundle = await rollup({
        input: {
          index: `${tmp}/index.js`,
        },
        external: [
          // dependencies could have deep exports, so we need a regex
          ...Object.keys(pkg.dependencies || {}).map(
            (d) => new RegExp(`^${d}(\\/.*)?$`)
          ),
        ],
        plugins: [
          nodeResolve({
            preferBuiltins: true,
            exportConditions: ["node"],
          }),
          commonjs({ strictRequires: true }),
          json(),
        ],
      });

      await bundle.write({
        format: "esm",
        sourcemap: true,
        dir: `${out}/server`,
        chunkFileNames: "chunks/[name]-[hash].js",
      });

      builder.copy(files, out, {
        replace: {
          ENV: "./env.js",
          SHIMS: "./shims.js",
          SERVER: "./server/index.js",
          ENV_PREFIX: JSON.stringify(envPrefix),
        },
      });

      // If polyfills aren't wanted then clear the file
      if (!polyfill) {
        writeFileSync(`${out}/shims.js`, "", "utf-8");
      }
    },
  };
}
