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

import * as Effect from "effect/Effect";
import * as Either from "effect/Either";
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
import { dedent } from "ts-dedent";

import { Config, ValidatedConfig } from "../Config/schema.js";
import { BuildData } from "../types/internal.js";
import { mkdirp, rimraf } from "../utils/filesystem.js";
import { build_service_worker } from "./build/service_worker.js";
import { assets_base, logger } from "./utils/index.js";

import { adapt } from "../adapt/index.js";

import { transform } from "../compiler/html/index.js";
import * as Template from "../compiler/template/index.js";

import { VITE_HTML_PLACEHOLDER } from "../utils/constants.js";

import { preview } from "./preview/index.js";

import * as CoreConfig from "../Config/config.js";
import * as Core from "../Core.js";
import { FileSystemLive } from "../FileSystem.js";
import * as Generated from "../Generated/index.js";
import { Logger as SimpleLogger } from "../Logger.js";
import { module_guard } from "./graph_analysis/index.js";

// plugins
import { plugin_dev_server } from "./plugin-dev-server/index.js";
import { plugin_env } from "./plugin-env/index.js";

function create_service_worker_module(
  config: ValidatedConfig,
  assets: Array<Core.Asset>
) {
  return dedent`
  if (typeof self === 'undefined' || self instanceof ServiceWorkerGlobalScope === false) {
    throw new Error('This module can only be imported inside a service worker');
  }
  
  export const files = [
    ${pipe(
      assets,
      List.filter((asset) => config.serviceWorker.files(asset.file)),
      List.map((asset) => `${s(`${config.paths.base}/${asset.file}`)}`),
      List.join(",\n")
    )}
  ];
  `;
}

const s = JSON.stringify;

const html_file_regex = /\.html$/;

const html_postfix_regex = /[?#].*$/s;

const html_postfix = "?html-import";

const vite_client_regex =
  /<script type="module" src="\/@vite\/client"><\/script>/g;

const cwd = process.cwd();

let build_step: "client" | "server";

let views: Effect.Effect.Success<
  Effect.Effect.Success<typeof Core.Entry>["views"]
>;

let assets: Effect.Effect.Success<
  Effect.Effect.Success<typeof Core.Entry>["assets"]
> | null = null;

let serverEntry: Effect.Effect.Success<
  Effect.Effect.Success<typeof Core.Entry>["server"]
>;

const CoreFileSystem = FileSystemLive.pipe(Layer.use(NodeFileSystem.layer));

export async function leanweb(user_config?: Config) {
  let vite_env: ConfigEnv;
  let vite_server: ViteDevServer;
  let vite_config: ResolvedConfig;
  let user_vite_config: UserConfig;

  let finalize: () => Promise<void>;

  const config_ = CoreConfig.prepare(user_config, { cwd });

  if (Either.isLeft(config_)) {
    console.log(colors.red("Invalid config"));
    console.log(colors.red(String(config_.left.cause.stack)));
    process.exit(1);
  }

  const config = config_.right;

  const layer = Layer.mergeAll(
    Logger.replace(Logger.defaultLogger, SimpleLogger),
    Layer.succeed(Core.Config, config),
    NodeFileSystem.layer,
    CoreFileSystem
  );

  const runtime = Layer.toRuntime(layer).pipe(Effect.scoped, Effect.runSync);

  const runFork = Runtime.runFork(runtime);
  const runSync = Runtime.runSync(runtime);
  const runPromise = Runtime.runPromise(runtime);

  const core = await runPromise(Core.Entry);

  const root_output_directory = config.outDir;
  const output_directory = `${root_output_directory}/output`;

  const generated = `${root_output_directory}/generated`;

  const views_out_directory = path.join(output_directory, "client");

  mkdirp(generated);

  const sourcemapIgnoreList = (relative_path: string) =>
    relative_path.includes("node_modules") ||
    relative_path.includes(root_output_directory);

  const setup: Plugin = {
    name: "leanweb:plugin-setup",
    configResolved(config) {
      vite_config = config;
    },
    configureServer(server) {
      vite_server = server;
    },
    configurePreviewServer(vite) {
      return preview(vite, vite_config, config);
    },
    async config(vite_config, config_env) {
      vite_env = config_env;
      user_vite_config = vite_config;

      let input: InputOption;
      const is_build = config_env.command === "build";

      if (is_build && build_step !== "server") {
        views = await runPromise(core.views);

        input = views.map((file) => file.file);

        await runPromise(
          Effect.all([
            Generated.writeTSConfig(config.outDir, config, cwd),
            Generated.writeEnv(config.outDir, config.env, config_env.mode),
            Generated.writeInternal(generated),
            Generated.writeConfig(config, generated),
            Generated.writeViews(generated, views),
          ])
        );
      } else {
        serverEntry = await pipe(
          Effect.log("Resolving server entry..."),
          Effect.flatMap(() => core.server),
          Effect.tap((entry) =>
            Option.isSome(entry)
              ? Effect.log(
                  `Server entry resolved: ${colors.green(entry.value)}`
                )
              : Effect.unit
          ),
          Effect.tap(
            Option.match({
              onNone: () => {
                const entry = user_config?.files?.entry;
                return entry
                  ? Effect.logFatal(
                      colors.red(
                        `Couldn't find the entry point specified in the configuration: ${colors.bold(
                          entry
                        )}`
                      )
                    )
                  : Effect.logFatal(
                      colors.red(
                        "No server entry point specified, and could not find the default entry point (src/entry.{js,ts,mjs,mts})"
                      )
                    );
              },
              onSome: (_) => Effect.unit,
            })
          ),
          Logger.withMinimumLogLevel(is_build ? LogLevel.None : LogLevel.All),
          runPromise
        );

        if (Option.isNone(serverEntry)) process.exit(1);

        input = {
          index: serverEntry.value,
          internal: `${generated}/internal.js`,
        };
      }

      const ssr = build_step === "server";
      const prefix = `${config.appDir}/immutable`;
      const build_directory = `${output_directory}/${
        ssr ? "server" : "client"
      }`;

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
        resolve: {
          alias: [{ find: "__GENERATED__", replacement: generated }],
        },
        optimizeDeps: {
          exclude: ["leanweb-kit"],
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
            user_vite_config.build?.minify == null
              ? true
              : !!user_vite_config.build.minify,
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

      if (vite_env.command === "build") {
        if (!vite_config.build.watch) rimraf(output_directory);
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

        const verbose = vite_config.logLevel === "info";
        const log = logger({ verbose });

        // Initiate second build step that builds the final server output
        await vite.build({
          mode: vite_env.mode,
          logLevel: vite_config.logLevel,
          configFile: vite_config.configFile,
          clearScreen: vite_config.clearScreen,
          optimizeDeps: {
            force: vite_config.optimizeDeps.force,
          },
          build: {
            minify: user_vite_config.build?.minify,
            sourcemap: vite_config.build.sourcemap,
            assetsInlineLimit: vite_config.build.assetsInlineLimit,
          },
        });

        const [assets_, service_worker] = await runPromise(
          Effect.all([core.assets, core.serviceWorker])
        );

        assets = assets_;

        if (Option.isSome(service_worker)) {
          if (config.paths.assets) {
            throw new Error(
              "Cannot use service worker alongside config.paths.assets"
            );
          }

          console.info("Building service worker");

          const client_manifest = JSON.parse(
            fs.readFileSync(
              `${output_directory}/client/${vite_config.build.manifest}`,
              "utf-8"
            )
          ) as Manifest;

          // const files = [...Object.values(client_manifest)].map(({ file }) => {
          //   const type = mime.getType(file);
          //   const url = path.resolve(views_out_directory, file);
          //   return { file, type, size: fs.statSync(url).size };
          // });

          await build_service_worker(
            output_directory,
            config,
            vite_config,
            {
              static: assets,
              assets: [...Object.values(client_manifest)].map((_) => _.file),
            },
            service_worker.value
          );
        }

        const build_data: BuildData = {
          assets,
          app_dir: config.appDir,
          app_path: `${config.paths.base.slice(1)}${
            config.paths.base ? "/" : ""
          }${config.appDir}`,
          service_worker: Option.isSome(service_worker)
            ? "service-worker.js"
            : null,
        };

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

  // Ensures that client-side code can't accidentally import `$env/[static|dynamic]/private` in `*.html` files
  const plugin_guard: Plugin = {
    name: "leanweb:vite-plugin-guard",

    writeBundle: {
      sequential: true,
      async handler(_options) {
        // if (vite_config.build.ssr) return;

        const guard = module_guard(this, {
          cwd: vite.normalizePath(process.cwd()),
        });

        views.forEach(({ file }) => {
          guard.check(file);
        });
      },
    },
  };

  const virtual_modules: Plugin = {
    name: "leabweb:plugin-virtual-modules",
    async resolveId(id) {
      if (id === "$service-worker") {
        return `\0${id}`;
      }
    },
    async load(id) {
      switch (id) {
        case "\0$service-worker":
          return pipe(
            assets ? Effect.succeed(assets) : core.assets,
            Effect.map((_) => create_service_worker_module(config, _)),
            runPromise
          );
      }
    },
  };

  // Walk html file and attach the source file name for each asset in the html file, so that
  // we can accurately identify and serve them during dev
  const serve: Plugin = {
    apply: "serve",
    name: "leanweb:plugin-dev",
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
    async transform(html, id) {
      const filename = id.endsWith(html_postfix)
        ? id.replace(html_postfix_regex, "")
        : id;

      if (html_file_regex.test(filename)) {
        const program = Effect.gen(function* ($) {
          const short_file = filename.replace(cwd, "");

          yield* $(Effect.log(`compiling ${short_file}`));

          const code = yield* $(
            Effect.if(isMarkdown(filename), {
              onFalse: Effect.succeed(html),
              onTrue: pipe(
                Template.markdown.compile(html),
                Effect.map(Option.map(({ code }) => code)),
                Effect.map(Option.getOrElse(() => html))
              ),
            })
          );

          const without_vite_client = yield* $(
            transform(code, { cwd, filename }),
            Effect.flatMap((code) =>
              Effect.promise(() =>
                vite_server.transformIndexHtml(filename, code)
              )
            ),
            /** Remove vite client just incase we have a component that has a svelte script with minimal html, cause
             * there'll be no head for vite to inject the vite client script. Which means we'll have two script tags
             * at the beginning of the file, which means the svelte compiler will throw an error
             **/
            Effect.map((html) => html.replace(vite_client_regex, () => ""))
          );

          return yield* $(
            Template.svelte.preprocess(without_vite_client, { filename }),
            Effect.flatMap((_) =>
              Template.svelte.compile(_.code, {
                filename,
                dev: true,
                sourcemap: _.map,
              })
            ),
            Effect.tap(() => Effect.log(`compiled ${short_file}`))
          );
        });

        const result = await runPromise(program);

        return result.js;
      }
    },
  };

  const build: Plugin = {
    apply: "build",
    enforce: "pre",
    name: "leanweb:plugin-build",
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
          onFalse: Effect.succeed(code),
          onTrue: Template.markdown
            .compile(code)
            .pipe(
              Effect.map(Option.map(({ code }) => code)),
              Effect.map(Option.getOrElse(() => code))
            ),
        }),
        Effect.flatMap((code) =>
          Template.svelte.preprocess(code, { filename: id })
        ),
        Effect.flatMap(({ code }) => Template.svelte.compile(code)),
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
    name: "leanweb:plugin-strip",
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
    name: "leanweb:plugin-restore",
    transformIndexHtml(html) {
      return html.replace(`${VITE_HTML_PLACEHOLDER}\n`, "");
    },
  };

  const dev_server = await plugin_dev_server(config, { cwd });

  return [
    setup,
    serve,
    build,
    plugin_guard,
    strip_svelte,
    restore_script,
    virtual_modules,
    ...plugin_env(config),
    ...dev_server,
    // // @ts-expect-error
    // legacy({ targets: ["defaults", "not IE 11"] }),
  ];
}

function isMarkdown(filename: string) {
  const { name } = path.parse(filename);
  return name.endsWith(".md");
}
