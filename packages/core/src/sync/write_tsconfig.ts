import * as fs from "node:fs";
import * as path from "node:path";
import colors from "kleur";
import ts from "typescript";

import * as O from "@effect/data/Option";

import { write_if_changed } from "./utils.js";
import { posixify } from "../utils/filesystem.js";
import { ValidatedConfig } from "../config/schema.js";

function maybe_file(cwd: string, file: string) {
  const resolved = path.resolve(cwd, file);

  if (fs.existsSync(resolved)) {
    return O.some(resolved);
  }

  return O.none();
}

function project_relative(file: string) {
  return posixify(path.relative(".", file));
}

function remove_trailing_slashstar(file: string) {
  if (file.endsWith("/*")) {
    return file.slice(0, -2);
  } else {
    return file;
  }
}

// Generates the tsconfig that the user's tsconfig inherits from.
export function write_tsconfig(config: ValidatedConfig, cwd = process.cwd()) {
  const out = path.join(config.outDir, "tsconfig.json");

  const user_config = load_user_tsconfig(cwd);
  if (user_config) validate_user_config(config, cwd, out, user_config);

  // only specify baseUrl if a) the user doesn't specify their own baseUrl
  // and b) they have non-relative paths. this causes problems with auto-imports,
  // so we print a suggestion that they use relative paths instead
  // TODO(v2): never include base URL, and skip the check below
  let include_base_url = false;

  if (user_config && !user_config.options.compilerOptions?.baseUrl) {
    const non_relative_paths = new Set();

    for (const paths of Object.values(
      user_config?.options.compilerOptions?.paths || {}
    )) {
      for (const path of paths as any) {
        if (!path.startsWith(".")) non_relative_paths.add(path);
      }
    }

    if (non_relative_paths.size) {
      include_base_url = true;

      console.log(
        colors
          .bold()
          .yellow("Please replace non-relative compilerOptions.paths:\n")
      );

      for (const path of non_relative_paths) {
        console.log(`  - "${path}" -> "./${path}"`);
      }

      console.log(
        '\nDoing so allows us to omit "baseUrl" — which causes problems with imports — from the generated tsconfig.json. See https://github.com/sveltejs/kit/pull/8437 for more information.'
      );
    }
  }

  write_if_changed(
    out,
    JSON.stringify(get_tsconfig(config, include_base_url), null, "\t")
  );
}

// Generates the tsconfig that the user's tsconfig inherits from.
export function get_tsconfig(
  config: ValidatedConfig,
  include_base_url: boolean
) {
  const config_relative = (file: string) =>
    posixify(path.relative(config.outDir, file));

  const include = new Set([
    "ambient.d.ts",
    "leanweb.d.ts",
    "./types/**/$types.d.ts",
    config_relative("vite.config.ts"),
  ]);

  // TODO(v2): find a better way to include all src files. We can't just use routes/lib only because
  // people might have other folders/files in src that they want included.
  const src_includes = [path.resolve("src")].filter((dir) => {
    const relative = path.relative(path.resolve("src"), dir);
    return !relative || relative.startsWith("..");
  });

  for (const dir of src_includes) {
    include.add(config_relative(`${dir}/**/*.js`));
    include.add(config_relative(`${dir}/**/*.ts`));
    include.add(config_relative(`${dir}/**/*.html`));
  }

  // Test folder is a special case - we advocate putting tests in a top-level test folder
  // and it's not configurable (should we make it?)
  const test_folder = project_relative("tests");

  include.add(config_relative(`${test_folder}/**/*.js`));
  include.add(config_relative(`${test_folder}/**/*.ts`));
  include.add(config_relative(`${test_folder}/**/*.html`));

  const exclude = [config_relative("node_modules/**"), "./[!ambient.d.ts]**"];

  if (path.extname(config.files.serviceWorker)) {
    exclude.push(config_relative(config.files.serviceWorker));
  } else {
    exclude.push(config_relative(`${config.files.serviceWorker}.js`));
    exclude.push(config_relative(`${config.files.serviceWorker}.ts`));
    exclude.push(config_relative(`${config.files.serviceWorker}.d.ts`));
  }

  const tsconfig = {
    compilerOptions: {
      // generated options
      rootDirs: [config_relative("."), "./types"],
      paths: get_tsconfig_paths(config, include_base_url),
      baseUrl: include_base_url ? config_relative(".") : undefined,

      // essential options
      // svelte-preprocess cannot figure out whether you have a value or a type, so tell TypeScript
      // to enforce using \`import type\` instead of \`import\` for Types.
      importsNotUsedAsValues: "error",
      // Vite compiles modules one at a time
      isolatedModules: true,
      // TypeScript doesn't know about import usages in the template because it only sees the
      // script of a Svelte file. Therefore preserve all value imports. Requires TS 4.5 or higher.
      preserveValueImports: true,

      // This is required for svelte-package to work as expected
      // Can be overwritten
      lib: ["esnext", "DOM", "DOM.Iterable"],
      moduleResolution: "node",
      module: "esnext",
      target: "esnext",

      // TODO(v2): use the new flag verbatimModuleSyntax instead (requires support by Vite/Esbuild)
      ignoreDeprecations:
        ts && Number(ts.version.split(".")[0]) >= 5 ? "5.0" : undefined,
    },
    include: [...include],
    exclude,
  };

  return tsconfig;
}

function load_user_tsconfig(cwd: string) {
  const file =
    maybe_file(cwd, "tsconfig.json") || maybe_file(cwd, "jsconfig.json");

  if (O.isNone(file)) return;

  // we have to eval the file, since it's not parseable as JSON (contains comments)
  const json = fs.readFileSync(file.value, "utf-8");

  return { kind: path.basename(file.value), options: (0, eval)(`(${json})`) };
}

function validate_user_config(
  config: ValidatedConfig,
  cwd: string,
  out: string,
  tsconfig: { kind: string; options: any }
) {
  // we need to check that the user's tsconfig extends the framework config
  const extend = tsconfig.options.extends;

  const extends_framework_config =
    typeof extend === "string"
      ? path.resolve(cwd, extend) === out
      : Array.isArray(extend)
      ? extend.some((e) => path.resolve(cwd, e) === out)
      : false;

  const options = tsconfig.options.compilerOptions || {};

  if (!extends_framework_config) {
    let relative = posixify(path.relative(".", out));

    if (!relative.startsWith("./")) relative = "./" + relative;

    console.warn(
      colors
        .bold()
        .yellow(
          `Your ${tsconfig.kind} should extend the configuration generated by SvelteKit:`
        )
    );

    console.warn(`{\n  "extends": "${relative}"\n}`);
  }
}

// <something><optional /*>
const alias_regex = /^(.+?)(\/\*)?$/;

// <path><optional /* or .fileending>
const value_regex = /^(.*?)((\/\*)|(\.\w+))?$/;

/**
 * Generates tsconfig path aliases from kit's aliases.
 * Related to vite alias creation.
 */
function get_tsconfig_paths(
  config: ValidatedConfig,
  include_base_url: boolean
) {
  const config_relative = (file: string) =>
    posixify(path.relative(config.outDir, file));

  const alias: Record<string, string> = {};

  const paths: Record<string, string[]> = {};

  for (const [key, value] of Object.entries(alias)) {
    const key_match = alias_regex.exec(key);

    if (!key_match) throw new Error(`Invalid alias key: ${key}`);

    const value_match = value_regex.exec(value);

    if (!value_match) throw new Error(`Invalid alias value: ${value}`);

    const rel_path = (include_base_url ? project_relative : config_relative)(
      remove_trailing_slashstar(value)
    );

    const slashstar = key_match[2];

    if (slashstar) {
      paths[key] = [rel_path + "/*"];
    } else {
      paths[key] = [rel_path];

      const fileending = value_match[4];

      if (!fileending && !(key + "/*" in alias)) {
        paths[key + "/*"] = [rel_path + "/*"];
      }
    }
  }

  return paths;
}
