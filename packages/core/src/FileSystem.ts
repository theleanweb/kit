import * as Effect from "effect/Effect";
import * as Context from "effect/Context";
import * as Layer from "effect/Layer";

import * as PlatformFileSystem from "@effect/platform/FileSystem";

import { glob, GlobOptionsWithFileTypesUnset } from "glob";

export interface FileSystem extends PlatformFileSystem.FileSystem {
  glob(
    pattern: string | string[],
    options?: GlobOptionsWithFileTypesUnset
  ): Effect.Effect<never, Error, Array<string>>;
}

export const FileSystem = Context.Tag<FileSystem>();

export const FileSystemLive = Layer.effect(
  FileSystem,
  Effect.gen(function* (_) {
    const fs = yield* _(PlatformFileSystem.FileSystem);

    return {
      ...fs,
      glob(...args) {
        return Effect.tryPromise({
          try: () => glob(...args),
          catch: (e) => e as Error,
        });
      },
    };
  })
);
