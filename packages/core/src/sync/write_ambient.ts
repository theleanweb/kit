import * as path from "node:path";
import { fileURLToPath } from "node:url";
import { ValidatedConfig } from "../config/schema.js";
import { Env } from "../types/internal.js";
import { GENERATED_COMMENT } from "../utils/constants.js";
import { get_env } from "../vite/utils/env/load.js";
import {
    create_dynamic_types,
    create_static_types,
} from "../vite/utils/env/resolve.js";
import { write_if_changed } from "./utils.js";

// TODO these types should be described in a neutral place, rather than
// inside either `packages/kit` or `kit.svelte.dev`
const descriptions_dir = fileURLToPath(
  new URL("../../../src/types/synthetic", import.meta.url)
);

function read_description(filename: string) {
  //   const content = fs.readFileSync(`${descriptions_dir}/${filename}`, "utf8");

  const content = "";

  return `/**\n${content
    .trim()
    .split("\n")
    .map((line) => ` * ${line}`)
    .join("\n")}\n */`;
}

const template = (
  env: Env,
  prefixes: { public_prefix: string; private_prefix: string }
) => `
${GENERATED_COMMENT}

/// <reference types="core" />

${read_description("$env+static+private.md")}
${create_static_types("private", env)}

${read_description("$env+static+public.md")}
${create_static_types("public", env)}

${read_description("$env+dynamic+private.md")}
${create_dynamic_types("private", env, prefixes)}

${read_description("$env+dynamic+public.md")}
${create_dynamic_types("public", env, prefixes)}
`;

/**
 * Writes ambient declarations including types reference to @sveltejs/kit,
 * and the existing environment variables in process.env to
 * $env/static/private and $env/static/public
 */
export function write_ambient(config: ValidatedConfig, mode: string) {
  const env = get_env(config.env, mode);

  const { publicPrefix: public_prefix, privatePrefix: private_prefix } =
    config.env;

  write_if_changed(
    path.join(config.outDir, "ambient.d.ts"),
    template(env, { public_prefix, private_prefix })
  );
}
