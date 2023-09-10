import { join } from "node:path";
import { pathToFileURL } from "node:url";
import {
  Server as HttpServer,
  IncomingMessage,
  ServerResponse,
} from "node:http";

import sirv from "sirv";
import { Server } from "connect";
import { ResolvedConfig } from "vite";

import { createMiddleware } from "@hattip/adapter-node";
import { Router } from "@hattip/router";

import { ValidatedConfig } from "../../config/schema.js";
import { installPolyfills } from "../../node/polyfills.js";
import { should_polyfill } from "../../utils/platform.js";

type Handler = (
  req: IncomingMessage,
  res: ServerResponse,
  next: () => void
) => void;

export async function preview(
  vite: { middlewares: Server; httpServer: HttpServer },
  vite_config: ResolvedConfig,
  config: ValidatedConfig
) {
  if (should_polyfill) {
    installPolyfills();
  }

  const dir = join(config.outDir, "output/server");

  const module = await import(pathToFileURL(join(dir, "index.js")).href);

  const router = module.default as Router;

  return () => {
    // generated client assets and the contents of `static`
    vite.middlewares.use(
      scoped(
        config.files.assets,
        sirv(join(config.outDir, "output/client"), {
          setHeaders: (res, pathname) => {
            // only apply to immutable directory, not e.g. version.json
            if (pathname.startsWith(`/${config.appDir}/immutable`)) {
              res.setHeader(
                "cache-control",
                "public,max-age=31536000,immutable"
              );
            }
          },
        })
      )
    );

    // SSR
    const middleware = createMiddleware(router.buildHandler());
    vite.middlewares.use(middleware);
  };
}

function scoped(scope: string, handler: Handler): Handler {
  if (scope === "") return handler;

  return (req, res, next) => {
    if (req.url?.startsWith(scope)) {
      const original_url = req.url;
      req.url = req.url.slice(scope.length);
      handler(req, res, () => {
        req.url = original_url;
        next();
      });
    } else {
      next();
    }
  };
}
