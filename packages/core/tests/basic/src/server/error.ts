import { Hono } from "hono";
import { view } from "leanweb-kit/runtime";

const router = new Hono();

router.get("/view", (ctx) => view(ctx, "errors/view.html"));

router.get("/handler", () => {
  throw new Error("Crashing now");
});

export default router;
