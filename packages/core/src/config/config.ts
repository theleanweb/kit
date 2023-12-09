import * as Path from "node:path";

import * as Either from "effect/Either";
import { pipe } from "effect/Function";
import { Config, ValidatedConfig } from "./schema.js";
import { ZodError } from "zod";

interface Options {
  readonly cwd: string;
}

class ConfigParseError {
  readonly _tag = "ConfigParseError";
  constructor(readonly cause: ZodError<Config>) {}
}

function parse(
  config: Config
): Either.Either<ConfigParseError, ValidatedConfig> {
  const result = Config.safeParse(config);
  return result.success
    ? Either.right(result.data as ValidatedConfig)
    : Either.left(new ConfigParseError(result.error));
}

function resolve(config: ValidatedConfig, { cwd }: Options) {
  const newConfig = { ...config };

  newConfig.outDir = Path.join(cwd, config.outDir);
  newConfig.files.entry = Path.join(cwd, config.files.entry);
  newConfig.files.views = Path.join(cwd, config.files.views);

  for (const k in config.files) {
    const key = k as keyof typeof config.files;
    newConfig.files[key] = Path.resolve(cwd, config.files[key]);
  }

  return newConfig;
}

export function prepare(config: Config | undefined, options: Options) {
  return pipe(
    parse(config ?? ({} as Config)),
    Either.map((_) => resolve(_, options))
  );
}
