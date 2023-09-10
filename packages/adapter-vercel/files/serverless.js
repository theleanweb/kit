import { installPolyfills } from "leanweb-kit/node/polyfills";
import { createMiddleware } from "@hattip/adapter-node";

import Router from "SERVER";

installPolyfills();

export default createMiddleware(Router.buildHandler(), { trustProxy: true });
