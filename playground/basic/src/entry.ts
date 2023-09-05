import { Hono } from "hono";

import { render } from "core/runtime";

import home from "./views/pages/home/home.html";
import about from "./views/pages/about/index.html";
import main from "./views/pages/main/index.html";

const app = new Hono();

app.get("/", (ctx) => ctx.html('Go to <a href="/about">About</a>'));

app.get("/main", async (ctx) => render("main", {}));

app.get("/home", async (ctx) => render("home/home.html", {}));

app.get("/about", async (ctx) => render("about", {}));

app.get("/sample", async (ctx) => {
  return render("about", {});
});

export default app;
