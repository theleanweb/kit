declare module "__GENERATED__/views.js" {
  export const views: Record<
    string,
    () => Promise<import("../types/internal.js").SSRComponent>
  >;
}

declare module "__GENERATED__/config.js" {
  const options: import("../Config/schema.js").ValidatedConfig;
  export default options;
}
