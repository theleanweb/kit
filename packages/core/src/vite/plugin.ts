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

import { MdsvexCompileOptions, compile as compileSvx } from "mdsvex";
import default_preprocess from "svelte-preprocess";
import { CompileOptions, compile, preprocess } from "svelte/compiler";

import * as Effect from "effect/Effect";
import * as Either from "effect/Either";
import * as Fiber from "effect/Fiber";
import { pipe } from "effect/Function";
import * as Layer from "effect/Layer";
import * as LogLevel from "effect/LogLevel";
import * as Logger from "effect/Logger";
import * as Option from "effect/Option";
import * as List from "effect/ReadonlyArray";
import * as Runtime from "effect/Runtime";

import * as NodeFileSystem from "@effect/platform-node/FileSystem";

import * as fs from "node:fs";
import * as path from "node:path";

import colors from "kleur";
import mime from "mime";
import { dedent } from "ts-dedent";

import { adapt } from "../adapt/index.js";
import { transform } from "../compiler/html/index.js";
import { Config, ValidatedConfig } from "../config/schema.js";
import { BuildData, Env } from "../types/internal.js";
import { VITE_HTML_PLACEHOLDER } from "../utils/constants.js";
import { mkdirp, posixify, rimraf } from "../utils/filesystem.js";
import { build_service_worker } from "./build/service_worker.js";
import { dev } from "./dev/index.js";
import { preview } from "./preview/index.js";
import { get_env } from "./utils/env/load.js";
import { create_static_module } from "./utils/env/resolve.js";
import { assets_base, logger } from "./utils/index.js";

import { FileSystemLive } from "../FileSystem.js";
import * as CoreConfig from "../config.js";
import * as Core from "../core.js";

const logLevelColors = {
  [LogLevel.Error._tag]: colors.red,
  [LogLevel.Info._tag]: colors.gray,
  [LogLevel.Fatal._tag]: colors.red,
  [LogLevel.Debug._tag]: colors.yellow,
  [LogLevel.Warning._tag]: colors.yellow,
};

const SimpleLogger = Logger.make(({ logLevel, message, date }) => {
  const color = logLevelColors[logLevel._tag];
  console.log(`${color(`${logLevel.label}`)} ${message}`);
});

const CoreFileSystem = FileSystemLive.pipe(Layer.use(NodeFileSystem.layer));

const svelte_preprocess =
  typeof default_preprocess == "function"
    ? default_preprocess
    : default_preprocess.default;

const html_file_regex = /\.html$/;

const html_postfix_regex = /[?#].*$/s;

const html_postfix = "?html-import";

const vite_client_regex =
  /<script type="module" src="\/@vite\/client"><\/script>/g;

const cwd = process.cwd();

const s = JSON.stringify;

let build_step: "client" | "server";

const preprocess_ = (
  source: string,
  options?: { filename?: string | undefined }
) => {
  return Effect.promise(() =>
    preprocess(source, [svelte_preprocess()], options)
  );
};

const compileTemplate = (
  source: string,
  { generate = "ssr", ...options }: CompileOptions = {}
) => Effect.try(() => compile(source, { ...options, generate }));

const compileMarkdown = (source: string, options?: MdsvexCompileOptions) =>
  Effect.promise(() => compileSvx(source, options)).pipe(
    Effect.flatMap(Option.fromNullable)
  );

export async function leanweb(user_config?: Config) {
  let vite_env_: ConfigEnv;
  let vite_server: ViteDevServer;
  let vite_config_: ResolvedConfig;
  let user_vite_config_: UserConfig;

  let cwd_env: Env;

  let finalize: () => Promise<void>;

  const conf = CoreConfig.prepare(user_config, { cwd });

  if (Either.isLeft(conf)) {
    console.log(colors.red("Invalid config"));
    console.log(colors.red(String(conf.left.cause.stack)));
    process.exit(1);
  }

  const config = conf.right;

  const coreConfig = Layer.succeed(Core.Config, config);

  const layer = Layer.mergeAll(
    Logger.replace(Logger.defaultLogger, SimpleLogger),
    NodeFileSystem.layer,
    CoreFileSystem,
    coreConfig
  );

  const runtime = Layer.toRuntime(layer).pipe(Effect.scoped, Effect.runSync);

  const runFork = Runtime.runFork(runtime);
  const runSync = Runtime.runSync(runtime);
  const runPromise = Runtime.runPromise(runtime);

  const core = await runPromise(Core.Entry);

  const views = runFork(core.views);
  const assets = runFork(core.assets);
  const serverEntry = runFork(core.server);
  const serviceWorker = runFork(core.serviceWorker);

  function create_service_worker_module(config: ValidatedConfig) {
    return Effect.gen(function* (_) {
      const files = yield* _(Fiber.join(assets));

      return dedent`
      if (typeof self === 'undefined' || self instanceof ServiceWorkerGlobalScope === false) {
        throw new Error('This module can only be imported inside a service worker');
      }
      
      export const files = [
        ${pipe(
          files,
          List.filter((asset) => config.serviceWorker.files(asset.file)),
          List.map((asset) => `${s(`${config.paths.base}/${asset.file}`)}`),
          List.join(",\n")
        )}
      ];
      `;
    });
  }

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
        const files = await pipe(views, Fiber.join, runPromise);
        input = files.map((file) => file.file);
      } else {
        const entry = await pipe(serverEntry, Fiber.join, runPromise);
        if (Option.isNone(entry)) process.exit(1);
        input = { index: entry.value, internal: `${generated}/internal.js` };
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
        appType: "custom",
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

        const assets_ = await pipe(assets, Fiber.join, runPromise);

        const service_worker = await pipe(
          serviceWorker,
          Fiber.join,
          runPromise
        );

        const build_data: BuildData = {
          assets: assets_,
          app_dir: config.appDir,
          app_path: `${config.paths.base.slice(1)}${
            config.paths.base ? "/" : ""
          }${config.appDir}`,
          service_worker: Option.isSome(service_worker)
            ? "service-worker.js"
            : null,
        };

        if (Option.isSome(service_worker)) {
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
            [...assets_, ...files],
            service_worker.value
          );
        }

        // we need to defer this to closeBundle, so that adapters copy files
        // created by other Vite plugins
        finalize = async () => {
          const cmd = colors.bold().cyan("npm run preview");
          console.log(`\nRun ${cmd} to preview your production build locally.`);

          rimraf(`${views_out_directory}/${config.files.views}`);

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
          return runPromise(create_service_worker_module(config));
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
          const file = id.replace(cwd, "");

          yield* $(Effect.log(`compiling ${file}`));

          const code = yield* $(
            Effect.if(isMarkdown(id), {
              onFalse: Effect.succeed(html),
              onTrue: pipe(
                compileMarkdown(html),
                Effect.map(({ code }) => code),
                Effect.catchTag("NoSuchElementException", () =>
                  Effect.succeed(html)
                )
              ),
            })
          );

          const without_vite_client = yield* $(
            transform(code, { cwd, filename: id }),
            Effect.flatMap((code) =>
              Effect.promise(() => vite_server.transformIndexHtml(id, code))
            ),
            /** Remove vite client just incase we have a component that has a svelte script with minimal html, cause
             * there'll be no head for vite to inject the vite client script. Which means we'll have two script tags
             * at the beginning of the file, which means the svelte compiler will throw an error
             **/
            Effect.map((html) => html.replace(vite_client_regex, () => ""))
          );

          return yield* $(
            preprocess_(without_vite_client, { filename: id }),
            Effect.flatMap(({ code }) =>
              compileTemplate(code, { dev: true, filename: id })
            ),
            Effect.tap(() => Effect.log(`compiled ${file}`))
          );
        });

        const result = await runPromise(program);

        return result.js;
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
        if (fs.existsSync(resolved)) return resolved;
      }
    },
    load(id) {
      if (!id.endsWith(html_postfix)) return;
      return fs.readFileSync(id.replace(html_postfix_regex, ""), "utf-8");
    },
    async transform(code, id) {
      if (!id.endsWith(html_postfix)) return;

      const clean_id = id.replace(html_postfix_regex, "");

      const result = await pipe(
        Effect.if(isMarkdown(clean_id), {
          onTrue: compileMarkdown(code).pipe(Effect.map(({ code }) => code)),
          onFalse: Effect.succeed(code),
        }),
        Effect.flatMap((code) => preprocess_(code, { filename: id })),
        Effect.flatMap(({ code }) => compileTemplate(code)),
        Effect.runPromise
      );

      return result.js;
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
