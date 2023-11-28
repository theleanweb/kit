import colors from "kleur";

// import * as Effect from "effect/Effect";
// import * as ELogger from "effect/Logger";
// import * as Context from "effect/Context";
// import * as Runtime from "effect/Runtime";

import { Logger } from "../../types/internal.js";
import { ValidatedConfig } from "../../Config/schema.js";

export function assets_base(config: ValidatedConfig) {
  return (config.paths.assets || config.paths.base || ".") + "/";
}

function noop() {}

export function logger({ verbose }: { verbose: boolean }) {
  const log: Logger = (msg) => console.log(msg.replace(/^/gm, "  "));

  const err = (msg: string) => console.error(msg.replace(/^/gm, "  "));

  log.success = (msg) => log(colors.green(`✔ ${msg}`));
  log.error = (msg) => err(colors.bold().red(msg));
  log.warn = (msg) => log(colors.bold().yellow(msg));

  log.minor = verbose ? (msg) => log(colors.grey(msg)) : noop;
  log.info = verbose ? log : noop;

  // return Effect.gen(function* (_) {
  //   const runtime = yield* _(Effect.runtime<never>());
  //   const run = Runtime.runSync(runtime);

  //   const log = (msg: string) => Effect.log(msg.replace(/^/gm, "  "));
  //   const err = (msg: string) => Effect.logError(msg.replace(/^/gm, "  "));

  //   const logger: Logger = (msg) => run(log(msg));

  //   logger.success = (msg) => run(Effect.log(colors.green(`✔ ${msg}`)));

  //   logger.error = (msg) => run(err(colors.bold().red(msg)));

  //   logger.warn = (msg) => run(Effect.logWarning(colors.bold().yellow(msg)));

  //   logger.minor = (msg) => run(verbose ? log(colors.grey(msg)) : Effect.unit);

  //   logger.info = (msg) => run(verbose ? log(msg) : Effect.unit);

  //   return logger;
  // });

  return log;
}
