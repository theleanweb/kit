declare global {
  const __LEANWEB_DEV__: boolean;
  const __LEANWEB_ADAPTER_NAME__: string;

  var Bun: object;
  var Deno: object;
}

export {};
