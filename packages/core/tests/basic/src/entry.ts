import { Hono } from "hono";

import env from "./server/env.js";
import errors from "./server/error.js";
import headers from "./server/headers.js";

const app = new Hono();

app.route("/env", env);
app.route("/errors", errors);
app.route("/headers", headers);

export default app;
