import { deleteCookie, getCookie, setCookie } from "hono/cookie";
import { view } from "leanweb-kit/runtime";
import { Hono } from "hono";

const app = new Hono();

app.get("/", (ctx) => {
  setCookie(ctx, "age", "20");
  return ctx.html('Go to <a href="/about">About</a>');
});

app.get("/main", (ctx) => view(ctx, "main", {}));

app.get("/home", async (ctx) => {
  console.log(getCookie(ctx, "age"));

  // throw new Error("fail");

  // return view(ctx, "home/home.html", {});
});

app.get("/about", (ctx) => view(ctx, "about", {}));

app.get("/destroy", (ctx) => {
  deleteCookie(ctx, "age");
  return ctx.redirect("/");
});

// app.onError((ctx) => {
//   return Response.json(JSON.stringify({ name: "hello" }));
// });

// export default app;
