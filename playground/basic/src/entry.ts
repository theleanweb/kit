import { getCookie, setCookie } from "hono/cookie";
import { render, Router, createSessionFactory } from "leanweb-kit/runtime";

const { getSession, commitSession, destroySession } = createSessionFactory({
  name: "user",
  // domain: "remix.run",
  // Expires can also be set (although maxAge overrides it when used in combination).
  // Note that this method is NOT recommended as `new Date` creates only one date on each server deployment, not a dynamic date in the future!
  //
  // expires: new Date(Date.now() + 60_000),
  httpOnly: true,
  maxAge: 60,
  path: "/",
  sameSite: "Strict",
  secure: true,
});

const app = new Router();

app.get("/", async (ctx) => {
  await commitSession(ctx, { user: "123" });
  setCookie(ctx, "age", "10");
  return ctx.html('Go to <a href="/about">About</a>');
});

app.get("/main", async () => render("main", {}));

app.get("/home", async (ctx) => {
  console.log(await getSession(ctx), getCookie(ctx, "age"));
  return render("home/home.html", {});
});

app.get("/about", async (ctx) => render("about", {}));

app.get("/destroy", async (ctx) => {
  destroySession(ctx);
  return ctx.redirect("/");
});

export default app;
