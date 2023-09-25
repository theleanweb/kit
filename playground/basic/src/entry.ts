import { cookie } from "@hattip/cookie";
import { session, SimpleCookieStore } from "@hattip/session";

import { createRouter, render } from "leanweb-kit/runtime";

const app = createRouter();

app.use(cookie());

app.use(
  session({
    // Session store
    store: new SimpleCookieStore(),
    // Default session data when a new session is created.
    // It can be a function.
    // It is shallow cloned, if you need a deep clone, use a function.
    defaultSessionData: { user: null },
  })
);

app.get("/", (ctx) => {
  ctx.session.data = { user: "123" };
  return new Response('Go to <a href="/about">About</a>', {
    headers: { "Content-Type": "text/html" },
  });
});

app.get("/main", async () => render("main", {}));

app.get("/home", async (ctx) => {
  console.log(ctx.session.data);
  return render("home/home.html", {});
});

app.get("/about", async (ctx) => render("about", {}));

export default app;
