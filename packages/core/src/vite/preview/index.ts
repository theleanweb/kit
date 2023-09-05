import { join } from "node:path";
import { pathToFileURL } from "node:url";
import sirv from "sirv";
import { ResolvedConfig } from "vite";

import { Server } from "connect";
import { Hono } from "hono";
import { Server as HttpServer, IncomingMessage, ServerResponse } from "http";
import { ValidatedConfig } from "../../config/schema.js";
import { should_polyfill } from "../../utils/platform.js";
import { getRequest, setResponse } from "../../node/index.js";
import { installPolyfills } from "../../node/polyfills.js";

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

  const protocol = vite_config.preview.https ? "https" : "http";

  const dir = join(config.outDir, "output/server");

  const module = await import(pathToFileURL(join(dir, "index.js")).href);

  const server = module.default as Hono;

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

    // vite.middlewares.use((req, res, next) => {
    // 	const original_url = req.url as string;
    // 	const { pathname } = new URL(original_url, "http://dummy");

    // 	if (pathname.startsWith(base)) {
    // 		next();
    // 	} else {
    // 		res.statusCode = 404;
    // 		not_found(req, res, base);
    // 	}
    // });

    // SSR
    vite.middlewares.use(async (req, res) => {
      const host = req.headers["host"];

      let request;

      try {
        request = await getRequest({
          base: `${protocol}://${host}`,
          request: req,
        });
      } catch (err: any) {
        res.statusCode = err.status || 400;
        return res.end("Invalid request body");
      }

      setResponse(res, await server.fetch(request));
    });
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
