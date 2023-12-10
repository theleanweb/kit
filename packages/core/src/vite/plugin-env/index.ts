import type { Plugin } from "vite";
import { ValidatedConfig } from "../../Config/schema.js";
import * as Env from "../../Env/env.js";

export function plugin_env(config: ValidatedConfig) {
  let env: Env.Env;

  const virtual_modules: Plugin = {
    name: "plugin-env",
    async config(_, config_env) {
      env = Env.get_env(config.env, config_env.mode);
      // exclude kit features so that libraries using them work even when they are prebundled
      // this does not affect app code, just handling of imported libraries that use $env
      return { optimizeDeps: { exclude: ["$env"] } };
    },
    async resolveId(id) {
      // treat $env/static/[public|private] as virtual
      if (id.startsWith("$env/")) return `\0${id}`;
    },
    async load(id) {
      switch (id) {
        case "\0$env/static/private":
          return Env.create_static_module("$env/static/private", env.private);
        case "\0$env/static/public":
          return Env.create_static_module("$env/static/public", env.public);
      }
    },
  };

  return [virtual_modules];
}
