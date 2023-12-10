import { Hono } from "hono";
import { view } from "leanweb-kit/runtime";

import env from "./server/env.js";
import errors from "./server/error.js";
import headers from "./server/headers.js";

const app = new Hono();
const views = new Hono();

views.get("/", (_) => view(_, "home.html"));
views.get("/nested", (_) => view(_, "nested/deeply/view.html"));
views.get("/imports/assets", (_) => view(_, "imports/asset"));
views.get("/imports/client", (_) => view(_, "imports/client"));

app.get("/views/index", (_) => view(_, "imports/asset"));

app.route("/env", env);
app.route("/errors", errors);
app.route("/headers", headers);
app.route("/views", views);

export default app;
