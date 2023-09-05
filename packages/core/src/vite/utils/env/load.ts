import { loadEnv } from "vite";
import { ValidatedConfig } from "../../../config/schema.js";

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

type PublicPrivate = { public_prefix: string; private_prefix: string };

export function filter_private_env(
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

export function filter_public_env(
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
