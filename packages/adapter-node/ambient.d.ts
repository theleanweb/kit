declare module "ENV" {
  export function env(key: string, fallback?: any): string;
}

declare module "SERVER" {
  const Router: import("@hattip/router").Router;
  export default Router;
}
