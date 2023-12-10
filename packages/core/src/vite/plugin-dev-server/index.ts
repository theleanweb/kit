import * as vite from "vite";
import {
  buildErrorMessage,
  type Plugin,
  type ResolvedConfig,
  type ViteDevServer,
} from "vite";

import * as Cause from "effect/Cause";
import * as Console from "effect/Console";
import * as Effect from "effect/Effect";
import * as Exit from "effect/Exit";
import { pipe } from "effect/Function";
import * as Layer from "effect/Layer";
import * as Logger from "effect/Logger";
import * as Option from "effect/Option";
import * as List from "effect/ReadonlyArray";
import * as Runtime from "effect/Runtime";

import * as NodeFileSystem from "@effect/platform-node/FileSystem";

import * as fs from "node:fs";
import * as path from "node:path";

import color from "kleur";

import { Server } from "connect";
import mime from "mime";
import sirv from "sirv";

import { Hono } from "hono";

import { ValidatedConfig } from "../../Config/schema.js";
import { mkdirp, posixify, to_fs } from "../../utils/filesystem.js";
import { getRequest, setResponse } from "../../node/index.js";
import { installPolyfills } from "../../node/polyfills.js";
import { coalesce_to_error } from "../../utils/error.js";
import { should_polyfill } from "../../utils/platform.js";
import { prepareError, template } from "./error.js";

import * as Core from "../../Core.js";
import { FileSystemLive } from "../../FileSystem.js";
import * as Generated from "../../Generated/index.js";
import { PrettyLogger } from "./logger.js";

const script_file_regex = /\.(js|ts)$/;

const css_file_regex = /\.(css|scss)$/;

const jsHeaders = { "content-type": "application/javascript" };

const CoreFileSystem = FileSystemLive.pipe(Layer.use(NodeFileSystem.layer));

export async function plugin_dev_server(
  config: ValidatedConfig,
  { cwd }: { cwd: string }
) {
  if (should_polyfill) {
    installPolyfills();
  }

  let vite_server: ViteDevServer;
  let vite_config: ResolvedConfig;

  const layer = Layer.mergeAll(
    Logger.replace(Logger.defaultLogger, PrettyLogger),
    Layer.succeed(Core.Config, config),
    NodeFileSystem.layer,
    CoreFileSystem
  );

  const runtime = Layer.toRuntime(layer).pipe(Effect.scoped, Effect.runSync);

  const runFork = Runtime.runFork(runtime);
  const runPromise = Runtime.runPromise(runtime);

  const core = await runPromise(Core.Entry);

  const { assets, serviceWorker } = config.files;

  const root_output_directory = config.outDir;
  const generated = `${root_output_directory}/generated`;

  let timeout: NodeJS.Timeout | null = null;

  function debounce(to_run: () => void) {
    timeout && clearTimeout(timeout);
    timeout = setTimeout(() => {
      timeout = null;
      to_run();
    }, 100);
  }

  function loadServer() {
    return pipe(
      Effect.promise(() => vite_server.ssrLoadModule(config.files.entry)),
      Effect.map((module) => Option.fromNullable(module.default)),
      Effect.map(Option.map((_) => _ as Hono))
    );
  }

  function fix_stack_trace(stack: string) {
    return stack ? vite_server.ssrRewriteStacktrace(stack) : stack;
  }

  function loud_ssr_load_module(url: string) {
    return pipe(
      Effect.tryPromise(() => vite_server.ssrLoadModule(url)),
      Effect.catchAll((e) => {
        const err = e as any;

        const msg = buildErrorMessage(err, [
          `Internal server error: ${err.message}`,
        ]);

        vite_server.config.logger.error(msg, { error: err });

        vite_server.ws.send({
          type: "error",
          err: {
            ...err,
            // these properties are non-enumerable and will
            // not be serialized unless we explicitly include them
            message: err.message,
            stack: err.stack,
          },
        });

        return Effect.fail(e);
      })
    );
  }

  function resolve(id: string) {
    return Effect.gen(function* (_) {
      const url = id.startsWith("..")
        ? `/@fs${path.posix.resolve(id)}`
        : `/${id}`;

      const [module, module_node] = yield* _(
        Effect.all([
          loud_ssr_load_module(url),
          Effect.tryPromise(() => vite_server.moduleGraph.getModuleByUrl(url)),
        ])
      );

      if (!module_node) {
        return yield* _(
          Effect.fail(new Error(`Could not find node for ${url}`))
        );
      }

      return { module, module_node, url };
    });
  }

  const watch = (event: string, cb: (file: string) => void) => {
    vite_server.watcher.on(event, (file) => {
      if (file.startsWith(config.files.views + path.sep)) {
        cb(file);
      }
    });
  };

  function update() {
    pipe(
      Effect.all([
        Generated.writeEnv(config.outDir, config.env, vite_config.mode),
        Generated.writeConfig(config, generated),
        Effect.logInfo("Scanning views directory...").pipe(
          Effect.flatMap(() => core.views),
          Effect.tap((views) => Generated.writeViews(generated, views)),
          Effect.tap((files) =>
            Effect.logInfo(`Found ${files.length} view files:\n`)
          ),
          Effect.tap((files) =>
            files.length > 0
              ? Console.log(
                  pipe(
                    files,
                    List.map((file) => color.green(`-> ${file.name}`)),
                    List.join("\n")
                  )
                )
              : Effect.unit
          )
        ),
      ]),
      Effect.catchAll((error) => {
        const message = error.message;
        vite_server.ws.send({ type: "error", err: { message, stack: "" } });
        return Effect.logError(color.bold().red(message));
      }),
      runFork
    );
  }

  mkdirp(generated);

  runFork(
    Effect.all([
      Generated.writeTSConfig(config.outDir, config, cwd),
      Generated.writeInternal(generated),
    ])
  );

  const sourcemapIgnoreList = (relative_path: string) =>
    relative_path.includes("node_modules") ||
    relative_path.includes(root_output_directory);

  const plugin: Plugin = {
    apply: "serve",
    name: "plugin-dev-server",
    configResolved(config) {
      vite_config = config;
    },
    config() {
      const allow = new Set([
        config.outDir,
        path.resolve("src"),
        path.resolve("node_modules"),
        path.resolve(vite.searchForWorkspaceRoot(cwd), "node_modules"),
      ]);

      return {
        server: {
          sourcemapIgnoreList,
          fs: {
            allow: [...allow],
          },
          watch: {
            ignored: [
              // Ignore all siblings of config.outDir/generated
              `${posixify(config.outDir)}/!(generated)`,
            ],
          },
        },
      };
    },
    configureServer(server) {
      vite_server = server;

      update();

      // Debounce add/unlink events because in case of folder deletion or moves
      // they fire in rapid succession, causing needless invocations.
      watch("add", () => debounce(update));
      watch("unlink", () => debounce(update));

      server.watcher.on("all", (_, file) => {
        if (file.startsWith(serviceWorker)) {
          runFork(Generated.writeConfig(config, generated));
        }
      });

      const staticServer = sirv(assets, {
        dev: true,
        maxAge: 0,
        etag: true,
        extensions: [],
        setHeaders: (res) => {
          res.setHeader("access-control-allow-origin", "*");
        },
      });

      server.middlewares.use((req, res, next) => {
        try {
          const base = `${server.config.server.https ? "https" : "http"}://${
            req.headers[":authority"] || req.headers.host
          }`;

          const decoded = decodeURI(new URL(base + req.url).pathname);
          const file = config.files.assets + decoded;

          if (fs.existsSync(file) && !fs.statSync(file).isDirectory()) {
            if (has_correct_case(file, assets)) {
              req.url = encodeURI(decoded);
              staticServer(req, res);
              return;
            }
          }

          next();
        } catch (e) {
          res.statusCode = 500;
          const error = coalesce_to_error(e);
          res.end(fix_stack_trace(error.stack as string));
        }
      });

      return () => {
        const serve_static_middleware = server.middlewares.stack.find(
          (middleware) =>
            (middleware.handle as Function).name === "viteServeStaticMiddleware"
        );

        // Vite will give a 403 on URLs like /test, /static, and /package.json preventing us from
        // serving routes with those names. See https://github.com/vitejs/vite/issues/7363
        remove_static_middlewares(server.middlewares);

        server.middlewares.use(async (req, res, next) => {
          req.url = req.originalUrl;

          const program = Effect.gen(function* (_) {
            const base = `${server.config.server.https ? "https" : "http"}://${
              req.headers[":authority"] || req.headers.host
            }`;

            const url = new URL(base + req.url);
            const decoded = decodeURI(url.pathname);

            if (!decoded.startsWith(config.paths.base)) {
              const msg = `The server is configured with a public base URL of ${base} - did you mean to visit ${
                base + req.url
              } instead?`;

              res.statusCode = 404;
              res.end(msg);
              return;
            }

            if (decoded === config.paths.base + "/service-worker.js") {
              yield* _(Effect.log("Resolving service worker..."));
              const resolved = yield* _(core.serviceWorker);

              if (Option.isSome(resolved)) {
                res.writeHead(200, jsHeaders);
                res.end(`import '${to_fs(resolved.value)}';`);
              } else {
                yield* _(Effect.logWarning("No service worker found"));
                res.writeHead(404);
                res.end("not found");
              }

              return;
            }

            // reference to the file that served the html containing the requested asset
            const source = url.searchParams.get("s");

            if (source) {
              const file = path.join(cwd, source);

              const isFile =
                fs.existsSync(file) && !fs.statSync(file).isDirectory();

              if (isFile) {
                if (is_script_request(file)) {
                  res.writeHead(200, jsHeaders);
                  res.end(`import '${to_fs(file)}';`);
                  return;
                }

                if (is_css_request(file)) {
                  const resolved = yield* _(resolve(file));
                  res.writeHead(200, { "content-type": "text/css" });
                  res.end(resolved.module.default);
                  return;
                }

                const contentType = mime.getType(file);

                if (contentType) {
                  res.writeHead(200, { "content-type": contentType });
                }

                const contents = fs.createReadStream(file);

                contents.pipe(res);

                return;
              }
            }

            let request = yield* _(
              Effect.try(() => getRequest({ base, request: req })),
              Effect.exit
            );

            if (Exit.isFailure(request)) {
              res.statusCode = 400;
              res.end("Invalid request body");
              return yield* _(Effect.logError(Cause.pretty(request.cause)));
            }

            const server_ = yield* _(loadServer());

            if (Option.isNone(server_)) {
              const msg = "No exported server/router in entry file";
              yield* _(Effect.logWarning(msg));
              return next();
            }

            const app_server = server_.value;

            app_server.onError((err) => {
              const error = template(prepareError(err));
              const headers = { "Content-Type": "text/html" };
              return new Response(error, { status: 500, headers });
            });

            const response = app_server.fetch(request.value);

            const rendered = yield* _(
              response instanceof Promise
                ? Effect.tryPromise(() => response)
                : Effect.try(() => response)
            );

            if (!rendered) {
              yield* _(
                Effect.logWarning("Request handler returned with no response"),
                Effect.annotateLogs("url", url)
              );
            }

            if (rendered.status === 404) {
              // @ts-expect-error
              serve_static_middleware.handle(req, res, () => {
                setResponse(res, rendered);
              });
            } else {
              setResponse(res, rendered);
            }
          });

          program.pipe(
            Effect.catchAll((e) => {
              res.statusCode = 500;

              console.log("dev", e);

              if (Cause.isCause(e)) {
                const err = Cause.pretty(e);
                res.end(err);
                return Effect.logError(err);
              } else {
                const error = coalesce_to_error(e);
                res.end(fix_stack_trace(error.stack!));
                return Effect.unit;
              }
            }),
            runFork
          );
        });
      };
    },
  };

  return [plugin];
}

function is_script_request(url: string) {
  return script_file_regex.test(url);
}

function is_css_request(url: string) {
  return css_file_regex.test(url);
}

/**
 * Determine if a file is being requested with the correct case,
 * to ensure consistent behaviour between dev and prod and across
 * operating systems. Note that we can't use realpath here,
 * because we don't want to follow symlinks
 */
function has_correct_case(file: string, assets: string): boolean {
  if (file === assets) return true;

  const parent = path.dirname(file);

  if (fs.readdirSync(parent).includes(path.basename(file))) {
    return has_correct_case(parent, assets);
  }

  return false;
}

function remove_static_middlewares(server: Server) {
  const static_middlewares = ["viteServeStaticMiddleware"];

  for (let i = server.stack.length - 1; i > 0; i--) {
    // @ts-expect-error using internals
    if (static_middlewares.includes(server.stack[i].handle.name)) {
      server.stack.splice(i, 1);
    }
  }
}
