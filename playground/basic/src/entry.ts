import { deleteCookie, getCookie, setCookie } from "hono/cookie";
import { Router, view } from "leanweb-kit/runtime";

const app = new Router();

app.get("/", (ctx) => {
  setCookie(ctx, "age", "20");
  return ctx.html('Go to <a href="/about">About</a>');
});

app.get("/main", (ctx) => view(ctx, "main", {}));

app.get("/home", (ctx) => {
  console.log(getCookie(ctx, "age"));
  return view(ctx, "home2/home.html", {});
});

app.get("/about", (ctx) => view(ctx, "about", {}));

app.get("/destroy", (ctx) => {
  deleteCookie(ctx, "age");
  return ctx.redirect("/");
});

export default app;
