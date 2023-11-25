import * as Path from "node:path";

import * as Effect from "effect/Effect";
import * as List from "effect/ReadonlyArray";
import * as FileSystem from "@effect/platform/FileSystem";

import { dedent } from "ts-dedent";

import { ValidatedConfig } from "../Config/schema.js";
import { pipe } from "effect/Function";

export function writeViews(
  output: string,
  files: Array<{ name: string; file: string }>
) {
  const dictionary = files.map(({ name, file }) => {
    const p = Path.parse(name);
    const relative = Path.relative(output, file);

    const entry = (name: string) =>
      `["${name}"]: async () => (await import('${relative}')).default`;

    if (p.name === "index" || p.name === p.dir) {
      return pipe(
        [name, `${p.dir}/${p.name}`, p.dir],
        List.map((name) => entry(name)),
        List.join(",\n")
      );
    }

    return entry(name);
  });

  return Effect.flatMap(FileSystem.FileSystem, (fs) =>
    fs.writeFileString(
      Path.join(output, "views.js"),
      `export const views = {\n${dictionary.join(",\n")}\n};`
    )
  );
}

export function writeInternal(output: string) {
  const exports = dedent`
  export * from './views.js';
  export * from './config.js'
  `;

  return Effect.flatMap(FileSystem.FileSystem, (fs) =>
    fs.writeFileString(Path.join(output, "internal.js"), exports)
  );
}

export function writeConfig(
  {
    adapter,
    serviceWorker: { files, ...serviceWorker },
    ...config
  }: ValidatedConfig,
  output: string
) {
  const exports = `export default ${JSON.stringify({
    ...config,
    serviceWorker,
  })}`;
  return Effect.flatMap(FileSystem.FileSystem, (fs) =>
    fs.writeFileString(Path.join(output, "config.js"), exports)
  );
}
