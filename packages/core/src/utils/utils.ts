import * as fs from "node:fs";
import * as path from "node:path";

import { pipe } from "@effect/data/Function";
import * as O from "@effect/data/Option";
import * as A from "@effect/data/ReadonlyArray";
import * as Effect from "@effect/io/Effect";
import * as Exit from "@effect/io/Exit";

function exists(entry: string) {
  return pipe(
    Effect.try({
      try: () => fs.accessSync(entry, fs.constants.F_OK),
      catch: () => new Error("FileError"),
    }),
    Effect.flatMap(() => Effect.succeed(true)),
    Effect.catchAll(() => Effect.succeed(false))
  );
}

export function resolveEntry(
  entry: string
): Effect.Effect<never, never, O.Option<string>> {
  return Effect.gen(function* (_) {
    const fileExits = yield* _(exists(entry), Effect.exit);

    if (Exit.isSuccess(fileExits) && fileExits.value) {
      const stats = yield* _(Effect.sync(() => fs.statSync(entry)));

      if (stats.isDirectory()) {
        return yield* _(resolveEntry(path.join(entry, "index")));
      }

      return O.some(entry);
    } else {
      const dir = path.dirname(entry);

      const dirExists = yield* _(Effect.sync(() => fs.existsSync(dir)));

      if (dirExists) {
        const base = path.basename(entry);

        const files = yield* _(Effect.sync(() => fs.readdirSync(dir)));

        return pipe(
          files,
          A.findFirst((file) => file.replace(/\.[^.]+$/, "") === base),
          O.map((found) => path.join(dir, found))
        );
      }
    }

    return O.none();
  });
}
