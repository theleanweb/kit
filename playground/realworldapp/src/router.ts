import { Hono } from "hono";

import * as Http from "http-kit";
import * as Fetch from "http-kit/fetch";

import { constNull, pipe } from "@effect/data/Function";
import * as O from "@effect/data/Option";
import * as Effect from "@effect/io/Effect";

import { render } from "leanweb-kit/runtime";

import { getCookie, setCookie } from "hono/cookie";
import { withApiUrl } from "./common/base-url.js";
import { withAuthToken } from "./common/with-token.js";
import type { Article } from "./core/models/article.js";
import type { User } from "./core/models/user.js";
import {
  getArticle,
  getArticles,
  getPersonalFeed,
} from "./core/services/article.js";
import { login, register, updateUser } from "./core/services/auth.js";
import { getPopularTags } from "./core/services/tag.js";
import { Tab } from "./views/types/tab.js";

// import MD, { metadata } from "./views/markdown/index.md.html";

// console.log(metadata);

type Variables = {
  user: User | null;
};

const app = new Hono<{ Variables: Variables }>();

app.use("*", (ctx, next) => {
  const cookie = pipe(
    O.fromNullable(getCookie(ctx, "auth")),
    O.match({ onNone: constNull, onSome: (_) => JSON.parse(_) })
  );

  ctx.set("user", cookie);

  return next();
});

app.get("/login", () => render("login"));

app.post("/login", (ctx) => {
  return pipe(
    Effect.tryPromise(() => ctx.req.formData()),
    Effect.flatMap((form) => login(Object.fromEntries(form) as any)),
    Effect.flatMap((data) => {
      return Effect.sync(() => {
        setCookie(ctx, "auth", JSON.stringify(data.user));
        return ctx.redirect("/");
      });
    }),
    Effect.catchAll((e) => {
      const err = e as any;

      const errors =
        "errors" in err
          ? err.errors
          : { unknown: ["An unknown error occurred"] };

      return Effect.tryPromise(() => render("login", { errors }));
    }),
    Http.provide(Fetch.adapter, withApiUrl),
    Effect.runPromise
  );
});

app.get("/register", () => render("register"));

app.post("/register", (ctx) => {
  return pipe(
    Effect.tryPromise(() => ctx.req.formData()),
    Effect.flatMap((form) => register(Object.fromEntries(form) as any)),
    Effect.flatMap((data) => {
      return Effect.sync(() => {
        setCookie(ctx, "auth", JSON.stringify(data.user));
        return ctx.redirect("/");
      });
    }),
    Effect.catchAll((e) => {
      const err = e as any;

      const errors =
        "errors" in err
          ? err.errors
          : { unknown: ["An unknown error occurred"] };

      return Effect.tryPromise(() => render("register", { errors }));
    }),
    Http.provide(Fetch.adapter, withApiUrl),
    Effect.runPromise
  );
});

app.get("/editor/:slug?", async (ctx) => {
  const slug = ctx.req.param("slug");

  let article: Partial<Article> = {
    body: "",
    title: "",
    tagList: [],
    description: "",
  };

  if (slug) {
    article = await pipe(
      getArticle(slug),
      Effect.map((_) => _.article),
      Http.provide(Fetch.adapter, withApiUrl),
      Effect.runPromise
    );
  }

  return render("editor", { article, user: ctx.get("user") });
});

app.post("/editor", async (ctx) => {
  const form = await ctx.req.formData();

  return render("editor", {
    article: {
      body: "",
      title: "",
      tagList: [],
      description: "",
    },
  });
});

app.get("/settings", (ctx) => render("settings", { user: ctx.get("user") }));

app.post("/settings", (ctx) => {
  return pipe(
    Effect.tryPromise(() => ctx.req.formData()),
    Effect.flatMap((form) => updateUser(Object.fromEntries(form))),
    Effect.flatMap((_) => {
      return Effect.sync(() => {
        setCookie(ctx, "auth", JSON.stringify(_.user));
        return ctx.redirect("/");
      });
    }),
    Effect.catchAll(() => {
      return Effect.tryPromise(() => {
        return render("settings", { user: ctx.get("user"), errors: null });
      });
    }),
    Http.provide(Fetch.adapter, withApiUrl),
    Effect.runPromise
  );
});

app.get("/post/@/:title{[a-z]+}", async (ctx) => {
  const user = ctx.get("user");

  console.log("profile", ctx.req.param());

  if (!user) return ctx.redirect("/login");

  // const data = await pipe(
  //   getProfile(ctx.req.param('user')),
  //   Effect.map((_) => _.),
  //   Http.provide(Fetch.adapter, withApiUrl, withAuthToken(user?.token)),
  //   Effect.runPromise
  // );

  return render("profile", { user });
});

app.get("/", async (ctx) => {
  let user = ctx.get("user");

  if (!user) {
    return ctx.redirect("/login");
  }

  const url = new URL(ctx.req.url);

  const search = url.searchParams;

  const tag = search.get("tag");

  const tab = pipe(
    O.fromNullable(search.get("tab")),
    O.getOrElse(() => (user ? Tab.Personal : Tab.Global))
  );

  const page = pipe(
    O.fromNullable(search.get("page")),
    O.map(parseFloat),
    O.getOrElse(() => 1)
  );

  const articles =
    tab === Tab.Personal
      ? getPersonalFeed({ offset: (page - 1) * 10 })
      : getArticles({
          offset: (page - 1) * 10,
          tag: tab === Tab.Global ? null : tag,
        });

  const tags = pipe(
    getPopularTags(),
    Effect.map((_) => _.tags)
  );

  const data = await pipe(
    Effect.all({ articles, tags }),
    Http.provide(Fetch.adapter, withApiUrl, withAuthToken(user.token)),
    Effect.runPromise
  );

  return render("home/index.html", {
    ...data.articles,
    tab: tag ? "tag" : tab,
    tags: data.tags,
    activeTag: tag,
    user,
  });
});

app.get("/articles/:slug", async (ctx) => {
  const data = await pipe(
    getArticle(ctx.req.param("slug")),
    Http.provide(Fetch.adapter, withApiUrl),
    Effect.runPromise
  );

  const user = ctx.get("user");

  return render("article", { ...data, user });
});

app.get("/markdown", () => render("markdown"));

app.showRoutes();

export default app;
