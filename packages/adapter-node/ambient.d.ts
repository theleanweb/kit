declare module "ENV" {
  export function env(key: string, fallback?: any): string;
}

declare module "HANDLER" {
  export const handler: import("hono").Hono;
}

declare module "SERVER" {
  const server: import("hono").Hono;
  export default server;
}
