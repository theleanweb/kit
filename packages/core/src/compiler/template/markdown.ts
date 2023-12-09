import { MdsvexCompileOptions, compile } from "mdsvex";

import * as Effect from "effect/Effect";
import * as Option from "effect/Option";
import { pipe } from "effect/Function";

const compileMarkdown = (source: string, options?: MdsvexCompileOptions) =>
  pipe(
    Effect.tryPromise(() => compile(source, options)),
    Effect.map(Option.fromNullable)
  );

export { compileMarkdown as compile };
