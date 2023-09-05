import colors from "kleur";
import { create_builder } from "./builder.js";
import { BuildData, Logger } from "../types/internal.js";
import { ValidatedConfig } from "../config/schema.js";

export async function adapt(
  config: ValidatedConfig,
  build_data: BuildData,
  log: Logger
) {
  const { name, adapt } = config.adapter!;

  console.log(colors.bold().cyan(`\n> Using ${name}`));

  const builder = create_builder({ log, config, build_data });

  await adapt(builder);

  log.success("done");
}
