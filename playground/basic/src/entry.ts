import { deleteCookie, getCookie, setCookie } from "hono/cookie";
import { view } from "leanweb-kit/runtime";
import { Hono } from "hono";

// import { API_URL, PRIVATE_API_URL } from "$env/static/private";
import { PUBLIC_API_KEY } from "$env/static/public";

console.log("server: ", PUBLIC_API_KEY);

const app = new Hono();

app.get("/", (ctx) => {
  setCookie(ctx, "age", "20");
  return ctx.html('Go to <a href="/about">About</a>');
});

app.get("/main", (ctx) => view(ctx, "main", {}));

app.get("/exception", (ctx) => view(ctx, "exception", {}));

app.get("/home", async (ctx) => {
  console.log(getCookie(ctx, "age"));

  // throw new Error("fail");

  return view(ctx, "home/home.html", {});
});

app.get("/about", (ctx) => view(ctx, "about", {}));

app.get("/destroy", (ctx) => {
  deleteCookie(ctx, "age");
  return ctx.redirect("/");
});

// app.onError((ctx) => {
//   return Response.json(JSON.stringify({ name: "hello" }));
// });

export default app;
