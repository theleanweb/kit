import type { InputOption } from "rollup";
import type {
  ConfigEnv,
  Manifest,
  Plugin,
  ResolvedConfig,
  UserConfig,
  ViteDevServer,
} from "vite";
import * as vite from "vite";

import { compile as compileSvx } from "mdsvex";
import { compile, preprocess } from "svelte/compiler";

import default_preprocess from "svelte-preprocess";

import * as Either from "effect/Either";
import { pipe } from "effect/Function";
import * as O from "effect/Option";
import * as Effect from "effect/Effect";
import * as Runtime from "effect/Runtime";
import * as Layer from "effect/Layer";
import * as Logger from "effect/Logger";
import * as LogLevel from "effect/LogLevel";
import * as LogSpan from "effect/LogSpan";

import * as fs from "node:fs";
import * as path from "node:path";

import colors from "kleur";
import mime from "mime";
import { dedent } from "ts-dedent";

import { adapt } from "../adapt/index.js";
import { transform } from "../compiler/html/index.js";
import { Config, ValidatedConfig } from "../config/schema.js";
import * as sync from "../sync/index.js";
import { create_assets } from "../sync/write_views.js";
import { Asset, BuildData, Env, View } from "../types/internal.js";
import { VITE_HTML_PLACEHOLDER } from "../utils/constants.js";
import { CompileError, HTMLTransformError } from "../utils/error.js";
import { mkdirp, posixify, rimraf } from "../utils/filesystem.js";
import { resolveEntry } from "../utils/utils.js";
import { build_service_worker } from "./build/service_worker.js";
import { dev } from "./dev/index.js";
import { preview } from "./preview/index.js";
import { get_env } from "./utils/env/load.js";
import { create_static_module } from "./utils/env/resolve.js";
import { assets_base, logger } from "./utils/index.js";

const logLevelColors = {
  [LogLevel.Error._tag]: colors.red,
  [LogLevel.Info._tag]: colors.gray,
  [LogLevel.Fatal._tag]: colors.red,
  [LogLevel.Debug._tag]: colors.yellow,
};

const SimpleLogger = Logger.make(({ logLevel, message, date }) => {
  const color = logLevelColors[logLevel._tag];
  console.log(`${color(`${logLevel.label}`)} ${message}`);
});

const layer = Logger.replace(Logger.defaultLogger, SimpleLogger);

const runtime = Layer.toRuntime(layer).pipe(Effect.scoped, Effect.runSync);

const runFork = Runtime.runFork(runtime);
const runSync = Runtime.runSync(runtime);
const runPromise = Runtime.runPromise(runtime);

class ConfigParseError {
  readonly _tag = "ConfigParseError";
}

class NoEntryFileError {
  readonly _tag = "NoEntryFileError";
}

const html_file_regex = /\.html$/;

const html_postfix_regex = /[?#].*$/s;

const html_postfix = "?html-import";

const vite_client_regex =
  /<script type="module" src="\/@vite\/client"><\/script>/g;

const cwd = process.cwd();

const s = JSON.stringify;

let build_step: "client" | "server";

let manifest: { assets: Asset[]; views: View[] };

export async function leanweb(user_config?: Config) {
  let vite_env_: ConfigEnv;
  let vite_server: ViteDevServer;
  let vite_config_: ResolvedConfig;
  let user_vite_config_: UserConfig;

  let cwd_env: Env;

  let finalize: () => Promise<void>;

  const parsed_user_config = parse_config(user_config ?? ({} as Config));

  const resolved_config = pipe(parsed_user_config, Either.map(resolve_config));

  if (Either.isLeft(resolved_config)) {
    throw resolved_config.left;
  }

  const config = resolved_config.right;

  const entry = runSync(resolveEntry(config.files.entry));

  if (O.isNone(entry)) {
    throw new NoEntryFileError();
  }

  const service_worker_file = resolveEntry(config.files.serviceWorker);

  const entry_file = entry.value;

  const root_output_directory = config.outDir;
  const output_directory = `${root_output_directory}/output`;

  const generated = `${root_output_directory}/generated`;

  const views_out_directory = path.join(output_directory, "client");

  mkdirp(generated);

  const sourcemapIgnoreList = (relative_path: string) =>
    relative_path.includes("node_modules") ||
    relative_path.includes(root_output_directory);

  const setup: Plugin = {
    name: "setup",
    configResolved(config) {
      vite_config_ = config;
    },
    configureServer(server) {
      vite_server = server;
      return dev(server, vite_config_, config);
    },
    configurePreviewServer(vite) {
      return preview(vite, vite_config_, config);
    },
    async config(vite_config, vite_config_env) {
      vite_env_ = vite_config_env;
      user_vite_config_ = vite_config;

      const is_build = vite_config_env.command === "build";

      cwd_env = get_env(config.env, vite_config_env.mode);

      let input: InputOption;

      if (is_build && build_step !== "server") {
        manifest = sync.all(config, vite_config_env.mode);
        input = manifest.views.map((view) => view.file);
      } else {
        input = { index: entry_file, internal: `${generated}/internal.js` };
      }

      const ssr = build_step === "server";
      const prefix = `${config.appDir}/immutable`;
      const build_directory = `${output_directory}/${
        ssr ? "server" : "client"
      }`;

      const allow = new Set([
        config.outDir,
        path.resolve("src"),
        path.resolve("node_modules"),
        path.resolve(vite.searchForWorkspaceRoot(cwd), "node_modules"),
      ]);

      return {
        root: cwd,
        publicDir: config.files.assets,
        base: !ssr ? assets_base(config) : "./",
        ssr: {
          noExternal: ["svelte", "esm-env", "leanweb-kit"],
        },
        define: {
          __LEANWEB_DEV__: !is_build ? "true" : "false",
          __LEANWEB_ADAPTER_NAME__: s(config.adapter?.name),
        },
        server: {
          sourcemapIgnoreList,
          fs: {
            allow: [...allow],
          },
          watch: {
            ignored: [
              // Ignore all siblings of config.kit.outDir/generated
              `${posixify(config.outDir)}/!(generated)`,
            ],
          },
        },
        resolve: {
          alias: [{ find: "__GENERATED__", replacement: generated }],
        },
        optimizeDeps: {
          exclude: [
            "leanweb-kit",
            // exclude kit features so that libraries using them work even when they are prebundled
            // this does not affect app code, just handling of imported libraries that use $app or $env
            "$env",
          ],
        },
        worker: {
          rollupOptions: {
            output: {
              hoistTransitiveImports: false,
              entryFileNames: `${prefix}/workers/[name]-[hash].js`,
              chunkFileNames: `${prefix}/workers/chunks/[name]-[hash].js`,
              assetFileNames: `${prefix}/workers/assets/[name]-[hash][extname]`,
            },
          },
        },
        build: {
          ssr,
          ssrEmitAssets: true,
          copyPublicDir: !ssr,
          outDir: build_directory,
          manifest: "vite-manifest.json",
          target: ssr ? "node16.14" : undefined,
          cssMinify:
            user_vite_config_.build?.minify == null
              ? true
              : !!user_vite_config_.build.minify,
          rollupOptions: {
            input,
            output: {
              sourcemapIgnoreList,
              hoistTransitiveImports: false,
              entryFileNames: ssr ? "[name].js" : `${prefix}/[name].[hash].js`,
              chunkFileNames: ssr
                ? "chunks/[name].js"
                : `${prefix}/chunks/[name].[hash].js`,
              assetFileNames: `${prefix}/assets/[name].[hash][extname]`,
            },
          },
        },
      };
    },
    buildStart() {
      if (build_step === "server") return;

      if (vite_env_.command === "build") {
        if (!vite_config_.build.watch) rimraf(output_directory);
        mkdirp(output_directory);
      }
    },
    /**
     * Runs the adapter.
     */
    async closeBundle() {
      if (build_step !== "server") return;
      await finalize?.();
    },
    async writeBundle() {
      if (build_step !== "server") {
        build_step = "server";

        const verbose = vite_config_.logLevel === "info";
        const log = logger({ verbose });

        const build_data: BuildData = {
          app_dir: config.appDir,
          assets: manifest.assets,
          app_path: `${config.paths.base.slice(1)}${
            config.paths.base ? "/" : ""
          }${config.appDir}`,
          service_worker: service_worker_file ? "service-worker.js" : null,
        };

        // Initiate second build step that builds the final server output
        await vite.build({
          mode: vite_env_.mode,
          logLevel: vite_config_.logLevel,
          configFile: vite_config_.configFile,
          clearScreen: vite_config_.clearScreen,
          optimizeDeps: {
            force: vite_config_.optimizeDeps.force,
          },
          build: {
            minify: user_vite_config_.build?.minify,
            sourcemap: vite_config_.build.sourcemap,
            assetsInlineLimit: vite_config_.build.assetsInlineLimit,
          },
        });

        const service_worker = runSync(service_worker_file);

        if (O.isSome(service_worker)) {
          if (config.paths.assets) {
            throw new Error(
              "Cannot use service worker alongside config.paths.assets"
            );
          }

          console.info("Building service worker");

          const client_manifest = JSON.parse(
            fs.readFileSync(
              `${output_directory}/client/${vite_config_.build.manifest}`,
              "utf-8"
            )
          ) as Manifest;

          const files = [...Object.values(client_manifest)].map(({ file }) => {
            const type = mime.getType(file);
            const url = path.resolve(views_out_directory, file);
            return { file, type, size: fs.statSync(url).size };
          });

          await build_service_worker(
            output_directory,
            config,
            vite_config_,
            [...manifest.assets, ...files],
            service_worker.value
          );
        }

        // we need to defer this to closeBundle, so that adapters copy files
        // created by other Vite plugins
        finalize = async () => {
          console.log(
            `\nRun ${colors
              .bold()
              .cyan(
                "npm run preview"
              )} to preview your production build locally.`
          );

          if (Either.isRight(parsed_user_config)) {
            rimraf(
              `${views_out_directory}/${parsed_user_config.right.files.views}`
            );
          }

          if (config.adapter) {
            await adapt(config, build_data, log);
          } else {
            console.log(colors.bold().yellow("\nNo adapter specified"));

            const link = colors
              .bold()
              .cyan("https://github.com/theleanweb/kit");

            console.log(
              `See ${link} to learn how to configure your app to run on the platform of your choosing`
            );
          }

          build_step = "client";
        };
      }
    },
  };

  const virtual_modules: Plugin = {
    name: "virtual-modules",
    async resolveId(id) {
      // treat $env/static/[public|private] as virtual
      if (id.startsWith("$env/") || id === "$service-worker") {
        return `\0${id}`;
      }
    },
    async load(id) {
      switch (id) {
        case "\0$env/static/private":
          return create_static_module("$env/static/private", cwd_env.private);

        case "\0$env/static/public":
          return create_static_module("$env/static/public", cwd_env.public);

        case "\0$service-worker":
          return create_service_worker_module(config);
      }
    },
  };

  // Walk html file and attach the source file name for each asset in the html file, so that
  // we can accurately identify and serve them during dev
  const compile_serve: Plugin = {
    apply: "serve",
    name: "plugin-compile-dev",
    // resolveId: {
    //   order: "pre",
    //   async handler(source, importer, options) {
    //     if (importer && html_file_regex.test(source)) {
    //       let res = await this.resolve(source, importer, {
    //         skipSelf: true,
    //         ...options,
    //       });

    //       // console.log("-------------");
    //       // console.log("\nresolve id: ", source, importer, isMarkdown(source));
    //       // console.log("-------------");

    //       if (!res || res.external) return res;

    //       if (isMarkdown(source)) {
    //         const parsed = path.parse(importer);
    //         const resolved = path.resolve(parsed.dir, source);
    //         return resolved + html_postfix;
    //       }
    //     }
    //   },
    // },
    load(id) {
      if (!id.endsWith(html_postfix)) return;
      return fs.readFileSync(id.replace(html_postfix_regex, ""), "utf-8");
    },
    async transform(html, id_) {
      const id = id_.endsWith(html_postfix)
        ? id_.replace(html_postfix_regex, "")
        : id_;

      if (html_file_regex.test(id)) {
        const program = Effect.gen(function* ($) {
          const display_id = id.replace(cwd, "");

          yield* $(Effect.log(`compiling ${display_id}`));

          const code = yield* $(
            isMarkdown(id)
              ? pipe(
                  Effect.tryPromise({
                    try: () => compileSvx(html),
                    catch: (e) => new CompileError(e as any),
                  }),
                  Effect.flatMap(O.fromNullable),
                  Effect.map((_) => _.code),
                  Effect.catchTag("NoSuchElementException", () =>
                    Effect.succeed(html)
                  )
                )
              : Effect.succeed(html)
          );

          const trnx_code = yield* $(transform(code, { cwd, filename: id }));

          const vite_html = yield* $(
            Effect.tryPromise({
              try: () => vite_server.transformIndexHtml(id, trnx_code),
              catch: (e) => new HTMLTransformError(e as any),
            })
          );

          /** Remove vite client just incase we have a component that has a svelte script with minimal html, cause
           * there'll be no head for vite to inject the vite client script. Which means we'll have two script tags
           * at the beginning of the file, which means the svelte compiler will throw an error
           **/
          const without_vite_client = vite_html.replace(
            vite_client_regex,
            () => ""
          );

          const preprocessed = yield* $(
            Effect.tryPromise({
              try: () =>
                preprocess(
                  without_vite_client,
                  // @ts-expect-error
                  [default_preprocess()],
                  { filename: id }
                ),
              catch: (e) => new CompileError(e as any),
            })
          );

          const component = yield* $(
            Effect.try({
              try: () =>
                compile(preprocessed.code, {
                  dev: true,
                  filename: id,
                  generate: "ssr",
                }),
              catch: (e) => new CompileError(e as any),
            })
          );

          yield* $(Effect.log(`compiled ${display_id}`));

          return component;
        }).pipe(Effect.withLogSpan("time"));

        const result = await pipe(program, Effect.either, runPromise);

        if (Either.isLeft(result)) {
          throw result.left;
        }

        return result.right.js;
      }
    },
  };

  const resolve_build: Plugin = {
    apply: "build",
    enforce: "pre",
    name: "plugin-resolve-build",
    async resolveId(source, importer, options) {
      if (build_step === "server" && importer && html_file_regex.test(source)) {
        let res = await this.resolve(source, importer, {
          skipSelf: true,
          ...options,
        });

        if (!res || res.external) return res;

        const parsed = path.parse(importer);

        /**
         * Given we've redirected imports to the client build output directory, we need
         * to then resolve an subsequent imports from files in that directory
         *
         * e.g given the following project structure
         * - root
         * ---- build
         * ---- src
         * ------ entry.ts // entry imports home
         * ------ views
         * -------- home.html // home imports footer
         * -------- footer.html
         *
         * We then compile the client and server outputs into the build folder. So initially
         * `home.html` is imported in `entry.ts` from `src/views/.../home.html` which we resolve down below (see RESOLVER) from `build/client/.../home.html`.
         *
         * Then `home.html` that was resolved from the `build` folder imports `build/client/.../footer.html`
         * which we then need to resolve from `build/client/.../footer.html`
         */
        if (importer.startsWith(views_out_directory)) {
          const resolved = path.resolve(parsed.dir, source);
          return resolved + html_postfix;
        }

        /**
         * [RESOLVER]
         *
         * Resolve html import from vite proceed html output
         *
         * To achieve that we reconstruct the actual equivalent file from the import file
         * url, point the import to the html file in the output directory
         */
        const resolved_view = path.join(
          views_out_directory,
          path.resolve(parsed.dir, source).substring(cwd.length)
        );

        return resolved_view + html_postfix;
      }

      // Given all the about transformation, we might have svelte components that import other kinds of
      // files. So we need to do the reverse (find the file in the project actual src directory), then resolve
      // the import
      if (importer && html_postfix_regex.test(importer)) {
        const id = importer.replace(html_postfix_regex, "");
        const src = path.join(cwd, id.replace(views_out_directory, ""));

        const parsed = path.parse(src);
        const resolved = path.resolve(parsed.dir, source);

        // The generated svelte component imports svelte internals, which means we'll not be able
        // to resolve it from the src directory. And should also take care of any node_modules import
        if (fs.existsSync(resolved)) {
          return resolved;
        }
      }
    },
    load(id) {
      if (!id.endsWith(html_postfix)) return;
      return fs.readFileSync(id.replace(html_postfix_regex, ""), "utf-8");
    },
    async transform(code, id) {
      if (!id.endsWith(html_postfix)) return;

      const clean_id = id.replace(html_postfix_regex, "");

      let code_ = code;

      if (isMarkdown(clean_id)) {
        const result = await compileSvx(code_);
        if (result) code_ = result.code;
      }

      // @ts-expect-error
      const preprocessed = await preprocess(code_, [default_preprocess()], {
        filename: id,
      });

      const res = compile(preprocessed.code, { generate: "ssr" });
      return res.js;
    },
  };

  // const strip_svelte: Plugin = {
  //   // apply: "build",
  //   name: "plugin-strip-svelte",
  //   transformIndexHtml: {
  //     order: "pre",
  //     async handler(html, ctx) {
  //       const { name } = path.parse(ctx.filename);

  //       let code = html;

  //       if (name.endsWith(".svx")) {
  //         const result = await compileSvx(code);
  //         if (result) code = result.code;
  //       }

  //       return `
  //       ${VITE_HTML_PLACEHOLDER}
  //       ${code}
  //       `;
  //     },
  //   },
  // };

  // Add an obfuscator so that vite's html parser doesn't error when it sees a script tag
  // at the beginning of the document
  const strip_svelte: Plugin = {
    name: "plugin-strip-svelte",
    transformIndexHtml: {
      order: "pre",
      handler(html) {
        return `${VITE_HTML_PLACEHOLDER}\n${html}`;
      },
    },
  };

  // Remove the above obfuscator
  const restore_script: Plugin = {
    enforce: "post",
    name: "plugin-restore-svelte",
    transformIndexHtml(html) {
      return html.replace(`${VITE_HTML_PLACEHOLDER}\n`, "");
    },
  };

  return [
    setup,
    compile_serve,
    resolve_build,
    strip_svelte,
    restore_script,
    virtual_modules,
    // // @ts-expect-error
    // legacy({ targets: ["defaults", "not IE 11"] }),
  ];
}

function isMarkdown(filename: string) {
  const { name } = path.parse(filename);
  return name.endsWith(".md");
}

function parse_config(config: Config) {
  const result = Config.safeParse(config);
  return result.success
    ? Either.right(result.data as ValidatedConfig)
    : Either.left(new ConfigParseError());
}

function resolve_config(config: ValidatedConfig) {
  const _config = { ...config };

  _config.outDir = path.join(cwd, config.outDir);
  _config.files.entry = path.join(cwd, config.files.entry);
  _config.files.views = path.join(cwd, config.files.views);

  for (const k in config.files) {
    const key = k as keyof typeof config.files;
    _config.files[key] = path.resolve(cwd, config.files[key]);
  }

  return _config;
}

function create_service_worker_module(config: ValidatedConfig) {
  const assets = runSync(create_assets(config));

  return dedent`
  if (typeof self === 'undefined' || self instanceof ServiceWorkerGlobalScope === false) {
    throw new Error('This module can only be imported inside a service worker');
  }
  
  export const files = [
    ${assets
      .filter((asset) => config.serviceWorker.files(asset.file))
      .map((asset) => `${s(`${config.paths.base}/${asset.file}`)}`)
      .join(",\n")}
  ];
`;
}
