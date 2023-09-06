import { Hono } from "hono";

import { render } from "leanweb-kit/runtime";

const app = new Hono();

app.get("/", (ctx) => ctx.html('Go to <a href="/about">About</a>'));

app.get("/main", async (ctx) => render("main", {}));

app.get("/home", async (ctx) => render("home/home.html", {}));

app.get("/about", async (ctx) => render("about", {}));

export default app;
