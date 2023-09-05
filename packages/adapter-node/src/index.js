import { serve } from "@hono/node-server";
import { serveStatic } from "@hono/node-server/serve-static";
import { env } from "ENV";
import server from "SERVER";
import { dirname, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export const path = env("SOCKET_PATH", false);
export const host = env("HOST", "0.0.0.0");
export const port = env("PORT", !path && "3000");

const dir = dirname(fileURLToPath(import.meta.url));

const assets = relative(process.cwd(), resolve(dir, "./client"));

server.use("/*", serveStatic({ root: assets }));

const handle = serve(server);

handle.listen({ path, host, port }, () => {
  console.log(`Listening on ${path ? path : host + ":" + port}`);
});

export { handle as server };
