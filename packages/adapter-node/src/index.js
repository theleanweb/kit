import { env } from "ENV";
import Router from "SERVER";

import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createServer } from "node:http";

import { createMiddleware } from "@hattip/adapter-node";
import sirv from "sirv";

export const path = env("SOCKET_PATH", false);
export const host = env("HOST", "0.0.0.0");
export const port = env("PORT", !path && "3000");

const dir = dirname(fileURLToPath(import.meta.url));

const assets = sirv(join(dir, 'client'));
const middleware = createMiddleware(Router.buildHandler());

const server = createServer(
  (req, res) => assets(req, res, () => middleware(req, res)),
)

server.listen({port, host})

console.log(`Server listening on http://${host}:${port}`);

export { server };
