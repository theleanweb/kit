import * as fs from "node:fs";
import * as path from "node:path";
import { URL } from "node:url";

import type { ResolvedConfig, ViteDevServer } from "vite";
import { buildErrorMessage } from "vite";

import color from "kleur";

import { Server } from "connect";
import mime from "mime";
import sirv from "sirv";

import { Hono } from "hono";

import * as Effect from "effect/Effect";
import * as Exit from "effect/Exit";
import { pipe } from "effect/Function";
import * as Layer from "effect/Layer";
import * as Logger from "effect/Logger";
import * as O from "effect/Option";
import * as Runtime from "effect/Runtime";
import * as Cause from "effect/Cause";

import * as NodeFileSystem from "@effect/platform-node/FileSystem";

import { FileSystemLive } from "../../FileSystem.js";
import * as Generated from "../../Generated/index.js";
import { Logger as SimpleLogger } from "../../Logger.js";
import * as Core from "../../core.js";

import { ValidatedConfig } from "../../config/schema.js";
import { getRequest, setResponse } from "../../node/index.js";
import { installPolyfills } from "../../node/polyfills.js";
import { coalesce_to_error } from "../../utils/error.js";
import { to_fs } from "../../utils/filesystem.js";
import { should_polyfill } from "../../utils/platform.js";

const script_file_regex = /\.(js|ts)$/;

const css_file_regex = /\.(css|scss)$/;

const cwd = process.cwd();

function is_script_request(url: string) {
  return script_file_regex.test(url);
}

function is_css_request(url: string) {
  return css_file_regex.test(url);
}

const CoreFileSystem = FileSystemLive.pipe(Layer.use(NodeFileSystem.layer));

export async function dev(
  vite: ViteDevServer,
  vite_config: ResolvedConfig,
  config: ValidatedConfig
) {
  if (should_polyfill) {
    installPolyfills();
  }

  const layer = Layer.mergeAll(
    Logger.replace(Logger.defaultLogger, SimpleLogger),
    Layer.succeed(Core.Config, config),
    NodeFileSystem.layer,
    CoreFileSystem
  );

  const runtime = await Layer.toRuntime(layer).pipe(
    Effect.scoped,
    Effect.runPromise
  );

  const runFork = Runtime.runFork(runtime);
  const runPromise = Runtime.runPromise(runtime);

  const core = await runPromise(Core.Entry);

  const generated = `${config.outDir}/generated`;

  runFork(
    Effect.all([
      Generated.writeTSConfig(config.outDir, config, cwd),
      // Generated.writeEnv(config.outDir, config.env, vite_config.mode),
      Generated.writeInternal(generated),
      // Generated.writeConfig(config, generated),
      // Effect.flatMap(core.views, (views) =>
      //   Generated.writeViews(generated, views)
      // ),
    ])
  );

  function loud_ssr_load_module(url: string) {
    return pipe(
      Effect.tryPromise(() => vite.ssrLoadModule(url)),
      Effect.catchAll((e) => {
        const err = e as any;

        const msg = buildErrorMessage(err, [
          `Internal server error: ${err.message}`,
        ]);

        vite.config.logger.error(msg, { error: err });

        vite.ws.send({
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
          Effect.tryPromise(() => vite.moduleGraph.getModuleByUrl(url)),
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

  function update() {
    pipe(
      Effect.all([
        Generated.writeEnv(config.outDir, config.env, vite_config.mode),
        Generated.writeConfig(config, generated),
        Effect.flatMap(core.views, (views) =>
          Generated.writeViews(generated, views)
        ),
      ]),
      Effect.catchAll((error) => {
        const message = error.message;
        vite.ws.send({ type: "error", err: { message, stack: "" } });
        return Effect.logError(color.bold().red(message));
      }),
      runFork
    );
  }

  function fix_stack_trace(stack: string) {
    return stack ? vite.ssrRewriteStacktrace(stack) : stack;
  }

  update();

  const watch = (event: string, cb: (file: string) => void) => {
    vite.watcher.on(event, (file) => {
      if (file.startsWith(config.files.views + path.sep)) {
        cb(file);
      }
    });
  };

  let timeout: NodeJS.Timeout | null = null;

  const debounce = (to_run: () => void) => {
    timeout && clearTimeout(timeout);
    timeout = setTimeout(() => {
      timeout = null;
      to_run();
    }, 100);
  };

  // Debounce add/unlink events because in case of folder deletion or moves
  // they fire in rapid succession, causing needless invocations.
  watch("add", () => debounce(update));
  watch("unlink", () => debounce(update));

  const { serviceWorker } = config.files;

  vite.watcher.on("all", (_, file) => {
    if (file.startsWith(serviceWorker)) {
      runFork(Generated.writeConfig(config, generated));
    }
  });

  const asset_server = sirv(config.files.assets, {
    dev: true,
    etag: true,
    maxAge: 0,
    extensions: [],
    setHeaders: (res) => {
      res.setHeader("access-control-allow-origin", "*");
    },
  });

  const ws_send = vite.ws.send;

  vite.ws.send = function (...args: any) {
    return ws_send.apply(vite.ws, args);
  };

  vite.middlewares.use((req, res, next) => {
    try {
      const base = `${vite.config.server.https ? "https" : "http"}://${
        req.headers[":authority"] || req.headers.host
      }`;

      const decoded = decodeURI(new URL(base + req.url).pathname);

      const file = config.files.assets + decoded;

      if (fs.existsSync(file) && !fs.statSync(file).isDirectory()) {
        if (has_correct_case(file, config.files.assets)) {
          req.url = encodeURI(decoded);
          asset_server(req, res);
          return;
        }
      }

      next();
    } catch (e) {
      const error = coalesce_to_error(e);
      res.statusCode = 500;
      res.end(fix_stack_trace(error.stack as string));
    }
  });

  return () => {
    const serve_static_middleware = vite.middlewares.stack.find(
      (middleware) =>
        (middleware.handle as Function).name === "viteServeStaticMiddleware"
    );

    // Vite will give a 403 on URLs like /test, /static, and /package.json preventing us from
    // serving routes with those names. See https://github.com/vitejs/vite/issues/7363
    remove_static_middlewares(vite.middlewares);

    vite.middlewares.use(async (req, res, next) => {
      req.url = req.originalUrl;

      const program = Effect.gen(function* (_) {
        const base = `${vite.config.server.https ? "https" : "http"}://${
          req.headers[":authority"] || req.headers.host
        }`;

        const url = new URL(base + req.url);
        const decoded = decodeURI(url.pathname);

        if (!decoded.startsWith(config.paths.base)) {
          res.statusCode = 404;

          res.end(
            `The server is configured with a public base URL of ${base} - did you mean to visit ${
              base + req.url
            } instead?`
          );

          return;
        }

        if (decoded === config.paths.base + "/service-worker.js") {
          const resolved = yield* _(core.serviceWorker);

          if (O.isSome(resolved)) {
            res.writeHead(200, { "content-type": "application/javascript" });
            res.end(`import '${to_fs(resolved.value)}';`);
          } else {
            res.writeHead(404);
            res.end("not found");
          }

          return;
        }

        // reference to the file that served the html containing the requested asset
        const source = url.searchParams.get("s");

        if (source) {
          const file = path.join(cwd, source);

          const is_file =
            fs.existsSync(file) && !fs.statSync(file).isDirectory();

          if (is_file) {
            if (is_script_request(file)) {
              res.writeHead(200, {
                "content-type": "application/javascript",
              });
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

        const server_ = yield* _(
          Effect.promise(() => vite.ssrLoadModule(config.files.entry)),
          Effect.map((module) => O.fromNullable(module.default)),
          Effect.map(O.map((_) => _ as Hono))
        );

        if (O.isNone(server_)) {
          yield* _(
            Effect.logWarning("No exported server/router in entry file")
          );

          return next();
        }

        const server = server_.value;

        server.onError((err) => {
          console.log("onError: ", err);
          return new Response("Internal server error", { status: 500 });
        });

        const response = server.fetch(request.value);

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

      pipe(
        program,
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
