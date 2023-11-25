import { ValidatedConfig } from "../Config/schema.js";
import { loadEnv } from "vite";

import { dedent } from "ts-dedent";
import { reserved, valid_identifier } from "./constant.js";
import { GENERATED_COMMENT } from "../utils/constants.js";

export interface Env {
  public: Record<string, string>;
  private: Record<string, string>;
}

type PublicPrivate = { public_prefix: string; private_prefix: string };

function filter_private_env(
  env: Record<string, string>,
  { public_prefix, private_prefix }: PublicPrivate
) {
  return Object.fromEntries(
    Object.entries(env).filter(
      ([k]) =>
        k.startsWith(private_prefix) &&
        (public_prefix === "" || !k.startsWith(public_prefix))
    )
  );
}

function filter_public_env(
  env: Record<string, string>,
  { public_prefix, private_prefix }: PublicPrivate
) {
  return Object.fromEntries(
    Object.entries(env).filter(
      ([k]) =>
        k.startsWith(public_prefix) &&
        (private_prefix === "" || !k.startsWith(private_prefix))
    )
  );
}

// Load environment variables from process.env and .env files
export function get_env(env_config: ValidatedConfig["env"], mode: string) {
  const { publicPrefix: public_prefix, privatePrefix: private_prefix } =
    env_config;

  const env = loadEnv(mode, env_config.dir, "");

  return {
    public: filter_public_env(env, { public_prefix, private_prefix }),
    private: filter_private_env(env, { public_prefix, private_prefix }),
  };
}

export function create_static_module(id: string, env: Record<string, string>) {
  const declarations: string[] = [];

  for (const key in env) {
    if (!valid_identifier.test(key) || reserved.has(key)) {
      continue;
    }

    const comment = `/** @type {import('${id}').${key}} */`;
    const declaration = `export const ${key} = ${JSON.stringify(env[key])};`;

    declarations.push(`${comment}\n${declaration}`);
  }

  return GENERATED_COMMENT + declarations.join("\n\n");
}

type EnvType = "public" | "private";

export function create_static_types(id: EnvType, env: Env) {
  const declarations = Object.keys(env[id])
    .filter((k) => valid_identifier.test(k))
    .map((k) => `export const ${k}: string;`);

  return dedent`
		declare module '$env/static/${id}' {
			${declarations.join("\n")}
		}
	`;
}

export function create_dynamic_types(
  id: EnvType,
  env: Env,
  { public_prefix, private_prefix }: PublicPrivate
) {
  const properties = Object.keys(env[id])
    .filter((k) => valid_identifier.test(k))
    .map((k) => `${k}: string;`);

  const public_prefixed = `[key: \`${public_prefix}\${string}\`]`;
  const private_prefixed = `[key: \`${private_prefix}\${string}\`]`;

  if (id === "private") {
    if (public_prefix) {
      properties.push(`${public_prefixed}: undefined;`);
    }

    properties.push(`${private_prefixed}: string | undefined;`);
  } else {
    if (private_prefix) {
      properties.push(`${private_prefixed}: undefined;`);
    }

    properties.push(`${public_prefixed}: string | undefined;`);
  }

  return dedent`
		declare module '$env/dynamic/${id}' {
			export const env: {
				${properties.join("\n")}
			}
		}
	`;
}
