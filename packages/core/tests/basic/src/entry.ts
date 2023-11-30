import { deleteCookie, getCookie, setCookie } from "hono/cookie";
import { view } from "leanweb-kit/runtime";
import { Hono } from "hono";

const app = new Hono();

app.get("/", (ctx) => {
  setCookie(ctx, "age", "20");
  return ctx.html('Go to <a href="/about">About</a>');
});

export default app;
