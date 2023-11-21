import svelte_preprocess from "svelte-preprocess";
import { CompileOptions, compile, preprocess } from "svelte/compiler";

import * as Effect from "effect/Effect";

const preprocess_ = (
  source: string,
  options?: { filename?: string | undefined }
) => {
  return Effect.promise(() =>
    preprocess(source, [svelte_preprocess()], options)
  );
};

const compileTemplate = (
  source: string,
  { generate = "ssr", ...options }: CompileOptions = {}
) => Effect.try(() => compile(source, { ...options, generate }));

export { compileTemplate as compile, preprocess_ as preprocess };
