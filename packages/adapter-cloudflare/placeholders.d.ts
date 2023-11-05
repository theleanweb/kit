declare module "SERVER" {
  const Router: import("hono").Hono;
  export default Router;
}

declare module "__STATIC_CONTENT_MANIFEST" {
  const json: string;
  export default json;
}
