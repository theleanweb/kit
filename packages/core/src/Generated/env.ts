import * as path from "node:path";
import { Env, create_dynamic_types, create_static_types } from "../Env/env.js";
import { ValidatedConfig } from "../Config/schema.js";
import { write_if_changed } from "../utils.js";
import { GENERATED_COMMENT } from "../utils/constants.js";
import { get_env } from "../Env/env.js";

const template = (
  env: Env,
  prefixes: { public_prefix: string; private_prefix: string }
) => `
${GENERATED_COMMENT}

/// <reference types="leanweb-kit" />

${create_static_types("private", env)}

${create_static_types("public", env)}

${create_dynamic_types("private", env, prefixes)}

${create_dynamic_types("public", env, prefixes)}
`;

/**
 * Writes ambient declarations including types reference to @leanweb/kit,
 * and the existing environment variables in process.env to
 * $env/static/private and $env/static/public
 */
export function writeEnv(
  output: string,
  env: ValidatedConfig["env"],
  mode: string
) {
  const env_ = get_env(env, mode);

  const { publicPrefix: public_prefix, privatePrefix: private_prefix } = env;

  return write_if_changed(
    path.join(output, "env.d.ts"),
    template(env_, { public_prefix, private_prefix })
  );
}
