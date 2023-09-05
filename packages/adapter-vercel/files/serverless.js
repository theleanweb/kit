import { installPolyfills } from "leanweb-kit/node/polyfills";
import { handle } from "@hono/node-server/vercel";

import Server from "SERVER";

installPolyfills();

export default handle(Server);
