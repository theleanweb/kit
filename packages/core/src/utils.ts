import * as path from "node:path";

import * as Effect from "effect/Effect";

import { FileSystem } from "@effect/platform/FileSystem";

const previous_contents = new Map<string, string>();

export function write_if_changed(file: string, code: string) {
  if (code !== previous_contents.get(file)) {
    return write(file, code);
  } else {
    return Effect.unit;
  }
}

export function write(file: string, code: string) {
  return Effect.gen(function* (_) {
    previous_contents.set(file, code);
    const fs = yield* _(FileSystem);
    yield* _(fs.makeDirectory(path.dirname(file), { recursive: true }));
    yield* _(fs.writeFileString(file, code));
  });
}
