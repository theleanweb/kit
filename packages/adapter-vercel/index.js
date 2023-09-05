// @ts-check

import { nodeFileTrace } from "@vercel/nft";
import esbuild from "esbuild";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const VALID_RUNTIMES = ["edge", "nodejs16.x", "nodejs18.x"];

const DEFAULT_FUNCTION_NAME = "fn";

const get_default_runtime = () => {
  const major = process.version.slice(1).split(".")[0];

  if (major === "16") return "nodejs16.x";
  if (major === "18") return "nodejs18.x";

  throw new Error(
    `Unsupported Node.js version: ${process.version}. Please use Node 16 or Node 18 to build your project, or explicitly specify a runtime in your adapter configuration.`
  );
};

/** @type {import('.').default} **/
const plugin = function (defaults = {}) {
  return {
    name: "adapter-vercel",

    async adapt(builder) {
      const dir = ".vercel/output";
      const tmp = builder.getBuildDirectory("vercel-tmp");

      builder.rimraf(dir);
      builder.rimraf(tmp);

      if (fs.existsSync("vercel.json")) {
        const vercel_file = fs.readFileSync("vercel.json", "utf-8");
        const vercel_config = JSON.parse(vercel_file);
        validate_vercel_json(builder, vercel_config);
      }

      const files = fileURLToPath(new URL("./files", import.meta.url).href);

      const dirs = {
        static: `${dir}/static${builder.config.paths?.base}`,
        functions: `${dir}/functions`,
      };

      const static_config = static_vercel_config(builder);

      builder.log.minor("Generating serverless function...");

      /**
       * @param {string} name
       * @param {import('.').ServerlessConfig} config
       */
      async function generate_serverless_function(name, config) {
        const relativePath = path.posix.relative(
          tmp,
          builder.getServerDirectory()
        );

        builder.copy(`${files}/serverless.js`, `${tmp}/index.js`, {
          replace: {
            SERVER: `${relativePath}/index.js`,
          },
        });

        await create_function_bundle(
          builder,
          `${tmp}/index.js`,
          `${dirs.functions}/${name}.func`,
          config
        );
      }

      /**
       * @param {string} name
       * @param {import('.').EdgeConfig} config
       */
      async function generate_edge_function(name, config) {
        const tmp = builder.getBuildDirectory(`vercel-tmp/${name}`);

        const relativePath = path.posix.relative(
          tmp,
          builder.getServerDirectory()
        );

        builder.copy(`${files}/edge.js`, `${tmp}/edge.js`, {
          replace: {
            SERVER: `${relativePath}/index.js`
          },
        });

        await esbuild.build({
          entryPoints: [`${tmp}/edge.js`],
          outfile: `${dirs.functions}/${name}.func/index.js`,
          target: "es2020", // TODO verify what the edge runtime supports
          bundle: true,
          platform: "browser",
          format: "esm",
          external: config.external,
          sourcemap: "linked",
          banner: { js: "globalThis.global = globalThis;" },
          loader: { ".wasm": "copy" },
        });

        write(
          `${dirs.functions}/${name}.func/.vc-config.json`,
          JSON.stringify(
            {
              runtime: config.runtime,
              regions: config.regions,
              entrypoint: "index.js",
            },
            null,
            "\t"
          )
        );
      }

      // we need to create a catch-all route so that 404s are handled
      // by SvelteKit rather than Vercel

      const runtime = defaults.runtime ?? get_default_runtime();

      const generate_function =
        runtime === "edge"
          ? generate_edge_function
          : generate_serverless_function;

      await generate_function(
        DEFAULT_FUNCTION_NAME,
        /** @type {any} */ ({ runtime, ...defaults }),
      );

      // Catch-all route must come at the end, otherwise it will swallow all other routes,
      // including ISR aliases if there is only one function
      static_config.routes.push({
        src: "/.*",
        // @ts-expect-error
        dest: `/${DEFAULT_FUNCTION_NAME}`,
      });

      builder.log.minor("Copying assets...");

      builder.writeClient(dirs.static);

      builder.log.minor("Writing routes...");

      write(`${dir}/config.json`, JSON.stringify(static_config, null, "\t"));
    },
  };
};

/** @param {import('.').EdgeConfig & import('.').ServerlessConfig} config */
function hash_config(config) {
  return [
    config.runtime ?? "",
    config.external ?? "",
    config.regions ?? "",
    config.memory ?? "",
    config.maxDuration ?? "",
    !!config.isr, // need to distinguish ISR from non-ISR functions, because ISR functions can't use streaming mode
  ].join("/");
}

/**
 * @param {string} file
 * @param {string} data
 */
function write(file, data) {
  try {
    fs.mkdirSync(path.dirname(file), { recursive: true });
  } catch {
    // do nothing
  }

  fs.writeFileSync(file, data);
}

// This function is duplicated in adapter-static
/** @param {import('leanweb-kit').Builder} builder */
function static_vercel_config(builder) {
  return {
    version: 3,
    routes: [
      {
        src: `/${builder.getAppPath()}/immutable/.+`,
        headers: {
          "cache-control": "public, immutable, max-age=31536000",
        },
      },
      {
        handle: "filesystem",
      },
    ],
  };
}

/**
 * @param {import('leanweb-kit').Builder} builder
 * @param {string} entry
 * @param {string} dir
 * @param {import('.').ServerlessConfig} config
 */
async function create_function_bundle(builder, entry, dir, config) {
  fs.rmSync(dir, { force: true, recursive: true });

  let base = entry;

  while (base !== (base = path.dirname(base)));

  const traced = await nodeFileTrace([entry], { base });

  /** @type {Map<string, string[]>} */
  const resolution_failures = new Map();

  traced.warnings.forEach((error) => {
    // pending https://github.com/vercel/nft/issues/284
    if (error.message.startsWith("Failed to resolve dependency node:")) return;

    // parse errors are likely not js and can safely be ignored,
    // such as this html file in "main" meant for nw instead of node:
    // https://github.com/vercel/nft/issues/311
    if (error.message.startsWith("Failed to parse")) return;

    if (error.message.startsWith("Failed to resolve dependency")) {
      const match = /Cannot find module '(.+?)' loaded from (.+)/;
      const [, module, importer] = match.exec(error.message) ?? [
        ,
        error.message,
        "(unknown)",
      ];

      if (!resolution_failures.has(importer)) {
        resolution_failures.set(importer, []);
      }

      /** @type {string[]} */ (resolution_failures.get(importer)).push(module);
    } else {
      throw error;
    }
  });

  if (resolution_failures.size > 0) {
    const cwd = process.cwd();

    builder.log.warn(
      "Warning: The following modules failed to locate dependencies that may (or may not) be required for your app to work:"
    );

    for (const [importer, modules] of resolution_failures) {
      console.error(`  ${path.relative(cwd, importer)}`);

      for (const module of modules) {
        console.error(`    - \u001B[1m\u001B[36m${module}\u001B[39m\u001B[22m`);
      }
    }
  }

  const files = Array.from(traced.fileList);

  // find common ancestor directory
  /** @type {string[]} */
  let common_parts = files[0]?.split(path.sep) ?? [];

  for (let i = 1; i < files.length; i += 1) {
    const file = files[i];
    const parts = file.split(path.sep);

    for (let j = 0; j < common_parts.length; j += 1) {
      if (parts[j] !== common_parts[j]) {
        common_parts = common_parts.slice(0, j);
        break;
      }
    }
  }

  const ancestor = base + common_parts.join(path.sep);

  for (const file of traced.fileList) {
    const source = base + file;
    const dest = path.join(dir, path.relative(ancestor, source));

    const stats = fs.statSync(source);
    const is_dir = stats.isDirectory();

    const realpath = fs.realpathSync(source);

    try {
      fs.mkdirSync(path.dirname(dest), { recursive: true });
    } catch {
      // do nothing
    }

    if (source !== realpath) {
      const realdest = path.join(dir, path.relative(ancestor, realpath));

      fs.symlinkSync(
        path.relative(path.dirname(dest), realdest),
        dest,
        is_dir ? "dir" : "file"
      );
    } else if (!is_dir) {
      fs.copyFileSync(source, dest);
    }
  }

  write(
    `${dir}/.vc-config.json`,
    JSON.stringify(
      {
        runtime: config.runtime,
        regions: config.regions,
        memory: config.memory,
        maxDuration: config.maxDuration,
        handler: path.relative(base + ancestor, entry),
        launcherType: "Nodejs",
      },
      null,
      "\t"
    )
  );

  write(`${dir}/package.json`, JSON.stringify({ type: "module" }));
}

/**
 *
 * @param {import('leanweb-kit').Builder} builder
 * @param {any} vercel_config
 */
function validate_vercel_json(builder, vercel_config) {
  const crons = /** @type {Array<unknown>} */ (
    Array.isArray(vercel_config?.crons) ? vercel_config.crons : []
  );

  /** @type {Array<string>} */
  const unmatched_paths = [];

  for (const cron of crons) {
    if (typeof cron !== "object" || cron === null || !("path" in cron)) {
      continue;
    }

    const { path } = cron;

    if (typeof path !== "string") {
      continue;
    }
  }

  if (unmatched_paths.length) {
    builder.log.warn(
      "\nWarning: vercel.json defines cron tasks that use paths that do not correspond to an API route with a GET handler (ignore this if the request is handled in your `handle` hook):"
    );

    for (const path of unmatched_paths) {
      console.log(`    - ${path}`);
    }

    console.log("");
  }
}

export default plugin;
