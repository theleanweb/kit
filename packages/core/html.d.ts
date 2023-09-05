declare module "*.md.html" {
  const Component: import("./src/types/internal.ts").SSRComponent;
  export const metadata: Record<string, unknown>;
  export default Component;
}

declare module "*.html" {
  const Component: import("svelte").ComponentType<
    import("svelte").SvelteComponent
  >;
  export default Component;
}
