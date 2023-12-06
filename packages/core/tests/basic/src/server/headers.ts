import { Hono } from "hono";
import { view } from "leanweb-kit/runtime";

const router = new Hono();

router.get("/content-type", (_) =>
  _.json({}, 200, { "Content-Type": "my/type" })
);

router.get("/set-cookie/:type", (_) => {
  const type = _.req.param("type");

  const headers = new Headers();
  headers.append("set-cookie", "cookie2=value2;");

  return type == "view"
    ? view(_, "empty", { headers })
    : _.text("set-cookie", { headers });
});

router.get("/custom/:type", (_) => {
  const type = _.req.param("type");

  const headers = new Headers();
  headers.append("custom-header", "my-value");

  return type == "view"
    ? view(_, "empty", { headers })
    : _.text("custom header", { headers });
});

export default router;
