import * as fs from "node:fs";
import * as path from "node:path";

import * as Effect from "effect/Effect";
import * as Option from "effect/Option";
import { pipe } from "effect/Function";

import { mkdirp } from "../utils/filesystem.js";

const previous_contents = new Map<string, string>();

export function write_if_changed(file: string, code: string) {
  if (code !== previous_contents.get(file)) {
    write(file, code);
  }
}

export function write(file: string, code: string) {
  previous_contents.set(file, code);
  mkdirp(path.dirname(file));
  fs.writeFileSync(file, code);
}
