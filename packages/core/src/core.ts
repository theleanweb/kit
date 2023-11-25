import color from "kleur";
import Mime from "mime";

import * as Path from "node:path";

import * as Console from "effect/Console";
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import { pipe } from "effect/Function";
import * as LogLevel from "effect/LogLevel";
import * as Logger from "effect/Logger";
import * as Option from "effect/Option";
import * as List from "effect/ReadonlyArray";

import { PlatformError } from "@effect/platform/Error";
import * as PlatformFileSystem from "@effect/platform/FileSystem";

import { FileSystem } from "./FileSystem.js";
import { ValidatedConfig } from "./Config/schema.js";

export interface Asset {
  file: string;
  size: number;
  type: string | null;
}

export interface View {
  file: string;
  name: string;
}

export const Config = Context.Tag<ValidatedConfig>();

export function resolve(
  entry: string
): Effect.Effect<
  PlatformFileSystem.FileSystem,
  PlatformError,
  Option.Option<string>
> {
  return Effect.gen(function* (_) {
    const fs = yield* _(PlatformFileSystem.FileSystem);

    const exists = yield* _(fs.exists(entry));

    if (exists) {
      const stat = yield* _(fs.stat(entry));

      if (stat.type == "Directory") {
        return yield* _(resolve(Path.join(entry, "index")));
      }

      return Option.some(entry);
    } else {
      const dir = Path.dirname(entry);
      const exists = yield* _(fs.exists(dir));

      if (exists) {
        const base = Path.basename(entry);

        const files = yield* _(fs.readDirectory(dir));

        return pipe(
          files,
          List.findFirst((file) => file.replace(/\.[^.]+$/, "") === base),
          Option.map((found) => Path.join(dir, found))
        );
      }
    }

    return Option.none();
  });
}

export const Entry = Effect.gen(function* (_) {
  const fs = yield* _(FileSystem);
  const config = yield* _(Config);

  return {
    server: Effect.gen(function* (_) {
      yield* _(Effect.log("Resolving server entry..."));

      const file = yield* _(resolve(config.files.entry));

      if (Option.isNone(file)) {
        yield* _(Effect.logFatal("No server entry found"));
      } else {
        yield* _(
          Effect.log(`Server entry resolved: ${color.green(file.value)}`)
        );
      }

      return file;
    }),
    views: Effect.gen(function* (_) {
      yield* _(Effect.log("Scanning views directory..."));

      const files = yield* _(fs.glob("**/*.html", { cwd: config.files.views }));

      yield* _(Effect.log(`Found ${files.length} files:`));

      if (files.length > 0) {
        yield* _(
          Effect.log(
            pipe(
              files,
              List.map((file) => color.green(`-> ${file}`)),
              List.join("\n")
            )
          )
        );
      }

      return List.map(files, (name) => {
        return { name, file: Path.resolve(config.files.views, name) };
      });
    }),
    assets: Effect.gen(function* (_) {
      const files = yield* _(fs.glob("**/*", { cwd: config.files.assets }));

      return yield* _(
        Effect.forEach(files, (file) => {
          return fs.stat(Path.resolve(config.files.assets, file)).pipe(
            Effect.map(({ size }) => {
              return {
                file,
                type: Mime.getType(file),
                size: parseFloat(size.toString()),
              } as Asset;
            })
          );
        })
      );
    }),
    serviceWorker: Effect.gen(function* (_) {
      yield* _(Effect.log("Resolving service worker..."));
      const file = yield* _(resolve(config.files.serviceWorker));

      if (Option.isNone(file)) {
        yield* _(Effect.logWarning("No service worker found"));
      } else {
        yield* _(
          Effect.log(`Service worker resolved: ${color.green(file.value)}`)
        );
      }

      return file;
    }),
  };
});
