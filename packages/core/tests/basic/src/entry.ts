import { deleteCookie, getCookie, setCookie } from "hono/cookie";
import { view } from "leanweb-kit/runtime";
import { Hono } from "hono";

import { PRIVATE_STATIC } from "$env/static/private";
import { env } from "$env/dynamic/private";

const app = new Hono();
const errors = new Hono();

app.get("/", (ctx) => {
  setCookie(ctx, "age", "20");
  return ctx.html('Go to <a href="/about">About</a>');
});

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
  headers.append("set-cookie", "answer=42; HttpOnly");
  headers.append("set-cookie", "problem=comma, separated, values; HttpOnly");
  return _.text("set-cookie", { headers });
});

app.get("set-cookie", (_) => {
  setCookie(_, "cookie1", "value1", {
    secure: false, // safari
  });

  return _.text("set-cookie");
});

app.get("/env", (ctx) =>
  view(ctx, "env", {
    PRIVATE_STATIC,
    PRIVATE_DYNAMIC: env.PRIVATE_DYNAMIC,
  })
);

errors.get("/view", (ctx) => view(ctx, "error/view"));

errors.get("/handler", () => {
  throw new Error("Crashing now");
});

app.route("/errors", errors);

export default app;
