import * as path from "node:path";

import { ValidatedConfig } from "../config/schema.js";
import { write_ambient } from "./write_ambient.js";
import { write_config } from "./write_config.js";
import { write_tsconfig } from "./write_tsconfig.js";
import { collect_views, create_assets, write_views } from "./write_views.js";

import * as Effect from "@effect/io/Effect";
import { write_server } from "./write_server.js";

export function init(config: ValidatedConfig, mode: string) {
  write_tsconfig(config);
  write_ambient(config, mode);
}

export function create(config: ValidatedConfig) {
  const manifest = Effect.runSync(
    Effect.all({ views: collect_views(config), assets: create_assets(config) })
  );

  const output = path.join(config.outDir, "generated");

  write_config(config, output);
  write_views(output, manifest.views);
  write_server(output);

  return manifest;
}

export function all(config: ValidatedConfig, mode: string) {
  init(config, mode);
  return create(config);
}

export function views(config: ValidatedConfig) {
  const views = Effect.runSync(collect_views(config));
  const output = path.join(config.outDir, "generated");
  write_views(output, views);
}

export function config(config: ValidatedConfig) {
  write_config(config, path.join(config.outDir, "generated"));
}
