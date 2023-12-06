import * as Path from "node:path";

import * as Effect from "effect/Effect";
import * as Option from "effect/Option";
import { pipe } from "effect/Function";
import * as Console from "effect/Console";

import * as FileSystem from "@effect/platform/FileSystem";

import colors from "kleur";
import ts from "typescript";

import { write_if_changed } from "../utils.js";
import { posixify } from "../utils/filesystem.js";
import { ValidatedConfig } from "../Config/schema.js";

function maybe_file(cwd: string, file: string) {
  const resolved = Path.resolve(cwd, file);

  return pipe(
    Effect.flatMap(FileSystem.FileSystem, (fs) => fs.exists(resolved)),
    Effect.map((exists) => (exists ? Option.some(resolved) : Option.none()))
  );
}

const project_relative = (file: string) => posixify(Path.relative(".", file));

function remove_trailing_slashstar(file: string) {
  if (file.endsWith("/*")) {
    return file.slice(0, -2);
  } else {
    return file;
  }
}

// Generates the tsconfig that the user's tsconfig inherits from.
export function writeTSConfig(
  output: string,
  config: ValidatedConfig,
  cwd = process.cwd()
) {
  return Effect.gen(function* (_) {
    const user_config = yield* _(load_user_tsconfig(cwd));

    const out = Path.join(output, "tsconfig.json");

    if (user_config) yield* _(validate_user_config(cwd, out, user_config));

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

        yield* _(
          Effect.log(
            colors
              .bold()
              .yellow("Please replace non-relative compilerOptions.paths:\n")
          )
        );

        for (const path of non_relative_paths) {
          yield* _(Effect.log(`  - "${path}" -> "./${path}"`));
        }

        yield* _(
          Effect.log(
            '\nDoing so allows us to omit "baseUrl" — which causes problems with imports — from the generated tsconfig.json. See https://github.com/theleanweb/kit/pull/8437 for more information.'
          )
        );
      }
    }

    yield* _(
      write_if_changed(
        out,
        JSON.stringify(
          get_tsconfig(output, config, include_base_url),
          null,
          "\t"
        )
      )
    );
  });
}

// Generates the tsconfig that the user's tsconfig inherits from.
export function get_tsconfig(
  output: string,
  config: ValidatedConfig,
  include_base_url: boolean
) {
  const config_relative = (file: string) =>
    posixify(Path.relative(output, file));

  const include = new Set([
    "env.d.ts",
    config_relative("leanweb.d.ts"),
    config_relative("vite.config.ts"),
  ]);

  // TODO(v2): find a better way to include all src files. We can't just use routes/lib only because
  // people might have other folders/files in src that they want included.
  const src_includes = [Path.resolve("src")].filter((dir) => {
    const relative = Path.relative(Path.resolve("src"), dir);
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

  const exclude = [config_relative("node_modules/**"), "./[!env.d.ts]**"];

  if (Path.extname(config.files.serviceWorker)) {
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
  return Effect.gen(function* (_) {
    const file = yield* _(
      maybe_file(cwd, "tsconfig.json"),
      Effect.orElse(() => maybe_file(cwd, "jsconfig.json"))
    );

    if (Option.isNone(file)) return;

    const fs = yield* _(FileSystem.FileSystem);

    // we have to eval the file, since it's not parseable as JSON (contains comments)
    const json = fs.readFileString(file.value, "utf-8");

    return { kind: Path.basename(file.value), options: (0, eval)(`(${json})`) };
  });
}

function validate_user_config(
  cwd: string,
  out: string,
  tsconfig: { kind: string; options: any }
) {
  return Effect.gen(function* (_) {
    // we need to check that the user's tsconfig extends the framework config
    const extend = tsconfig.options.extends;

    const extends_framework_config =
      typeof extend === "string"
        ? Path.resolve(cwd, extend) === out
        : Array.isArray(extend)
        ? extend.some((e) => Path.resolve(cwd, e) === out)
        : false;

    if (!extends_framework_config) {
      let relative = posixify(Path.relative(".", out));

      if (!relative.startsWith("./")) relative = "./" + relative;

      yield* _(
        Effect.logWarning(
          colors
            .bold()
            .yellow(
              `Your ${tsconfig.kind} should extend the configuration generated by Lean Web Kit:`
            )
        )
      );

      yield* _(Console.log(`{\n  "extends": "${relative}"\n}`));
    }
  });
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
    posixify(Path.relative(config.outDir, file));

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
