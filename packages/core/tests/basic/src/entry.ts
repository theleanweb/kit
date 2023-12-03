import { deleteCookie, getCookie, setCookie } from "hono/cookie";
import { view } from "leanweb-kit/runtime";
import { Hono } from "hono";

import { PRIVATE_STATIC } from "$env/static/private";
import { PUBLIC_STATIC } from "$env/static/public";
// import { env } from "$env/dynamic/private";

const app = new Hono();
const errors = new Hono();
const env = new Hono();

app.get("/content-type", (_) => view(_, "home"));

app.get("favicon.ico", (_) => _.json({ surprise: "lol" }));

app.get("/headers/echo", (_) => {
  const headers: Record<string, string> = {};

  _.req.raw.headers.forEach((value, key) => {
    if (key !== "cookie") {
      headers[key] = value;
    }
  });

  return _.json(headers);
});

app.get("headers/set-cookie", (_) => {
  const headers = new Headers();
  headers.append("set-cookie", "cookie2=value2;");
  return _.text("set-cookie", { headers });
});

app.get("set-cookie", (_) => {
  setCookie(_, "cookie1", "value1", {
    secure: false, // safari
  });

  return _.text("set-cookie");
});

env.get("/private/view", (ctx) => view(ctx, "env", { PRIVATE_STATIC }));
env.get("/public/view", (ctx) => view(ctx, "env", { PUBLIC_STATIC }));

env.get("/private", (ctx) => ctx.json({ PRIVATE_STATIC }));
env.get("/public", (ctx) => ctx.json({ PUBLIC_STATIC }));

errors.get("/view", (ctx) => view(ctx, "errors/view.html"));

errors.get("/handler", () => {
  throw new Error("Crashing now");
});

app.route("/env", env);
app.route("/errors", errors);

export default app;
