import { globSync } from "glob";
import * as fs from "node:fs";
import * as path from "node:path";
import { ValidatedConfig } from "../config/schema.js";
import { View } from "../types/internal.js";

import mime from "mime";

import { pipe } from "@effect/data/Function";
import * as A from "@effect/data/ReadonlyArray";
import * as Effect from "@effect/io/Effect";

export function create_assets(config: ValidatedConfig) {
  return pipe(
    Effect.try({
      try: () => globSync("**/*", { cwd: config.files.assets }),
      catch: () => new Error("GlobError: unable to scan pattern `**/*`"),
    }),
    Effect.map(
      A.map((file) => {
        const type = mime.getType(file);
        const resolved = path.resolve(config.files.assets, file);
        return { file, type, size: fs.statSync(resolved).size };
      })
    )
  );
}

export function collect_views(config: ValidatedConfig) {
  return pipe(
    Effect.try({
      try: () => globSync("**/*.html", { cwd: config.files.views }),
      catch: () => new Error("GlobError: unable to scan files"),
    }),
    Effect.map(
      A.map((name) => {
        const file = path.resolve(config.files.views, name);
        return { name, file };
      })
    )
  );
}

export async function write_views(output: string, files: Array<View>) {
  const dictionary = files.map(({ name, file }) => {
    const relative = path.relative(output, file);
    return `["${name}"]: async () => (await import('${relative}')).default`;
  });

  fs.writeFileSync(
    `${output}/views.js`,
    `export const views = {\n${dictionary.join(",\n")}\n};`
  );
}
