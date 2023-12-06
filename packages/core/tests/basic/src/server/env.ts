import { Hono } from "hono";
import { view } from "leanweb-kit/runtime";

import { PRIVATE_STATIC } from "$env/static/private";
import { PUBLIC_STATIC } from "$env/static/public";

const router = new Hono();

router.get("/private/:type", (ctx) => {
  const type = ctx.req.param("type");
  return type == "view"
    ? view(ctx, "env", { PRIVATE_STATIC })
    : ctx.json({ PRIVATE_STATIC });
});

router.get("/public/:type", (ctx) => {
  const type = ctx.req.param("type");
  return type == "view"
    ? view(ctx, "env", { PUBLIC_STATIC })
    : ctx.json({ PUBLIC_STATIC });
});

export default router;
