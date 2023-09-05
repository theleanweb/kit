import * as fs from "node:fs";
import { dedent } from "ts-dedent";
import { ValidatedConfig } from "../config/schema.js";
import { resolveEntry } from "../utils/utils.js";

import { constFalse, constTrue, pipe } from "@effect/data/Function";
import * as O from "@effect/data/Option";
import * as Effect from "@effect/io/Effect";

export function write_config(config: ValidatedConfig, output: string) {
  const has_service_worker_ = pipe(
    resolveEntry(config.files.serviceWorker),
    Effect.map(O.match({ onNone: constFalse, onSome: constTrue })),
    Effect.runSync
  );

  const has_service_worker =
    config.serviceWorker.register && has_service_worker_;

  fs.writeFileSync(
    `${output}/config.js`,
    dedent`
    export const options = {
      service_worker: ${has_service_worker},
      env_public_prefix: '${config.env.publicPrefix}',
    };
    `
  );
}
