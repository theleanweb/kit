import { installPolyfills } from "leanweb-kit/node/polyfills";
import { handle } from "@hono/node-server/vercel";

import Router from "SERVER";

installPolyfills();

export default handle(Router);
