import colors from "kleur";

import { Logger } from "../../types/internal.js";
import { ValidatedConfig } from "../../config/schema.js";

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

  return log;
}
