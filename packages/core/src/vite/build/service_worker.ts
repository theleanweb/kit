import * as fs from "node:fs";
import * as vite from "vite";
import { dedent } from "ts-dedent";
import type { ResolvedConfig } from "vite";

import { ValidatedConfig } from "../../Config/schema.js";
import { assets_base } from "../utils/index.js";
import { Asset } from "../../Core.js";

const s = JSON.stringify;

export async function build_service_worker(
  out: string,
  config: ValidatedConfig,
  vite_config: ResolvedConfig,
  {
    assets,
    static: static_,
  }: {
    assets: string[];
    static: Asset[];
  },
  service_worker_entry_file: string
) {
  const build = new Set();

  assets.forEach((file) => build.add(file));

  const service_worker = `${config.outDir}/generated/service-worker.js`;

  // in a service worker, `location` is the location of the service worker itself,
  // which is guaranteed to be `<base>/service-worker.js`
  const base = "location.pathname.split('/').slice(0, -1).join('/')";

  fs.writeFileSync(
    service_worker,
    dedent`
			export const base = /*@__PURE__*/ ${base};

      export const build = [
				${Array.from(build)
          .map((file) => `base + ${s(`/${file}`)}`)
          .join(",\n")}
			];

			export const files = [
				${static_
          .filter((asset) => config.serviceWorker.files(asset.file))
          .map((asset) => `base + ${s(`/${asset.file}`)}`)
          .join(",\n")}
			];

      export const version = 0;
		`
  );

  await vite.build({
    base: assets_base(config),
    publicDir: false,
    configFile: false,
    define: vite_config.define,
    build: {
      emptyOutDir: false,
      outDir: `${out}/client`,
      lib: {
        name: "app",
        formats: ["es"],
        entry: service_worker_entry_file,
      },
      rollupOptions: {
        output: {
          entryFileNames: "service-worker.js",
        },
      },
    },
    resolve: {
      alias: [
        // ...get_config_aliases(config),
        { find: "$service-worker", replacement: service_worker },
        // { find: "__SERVER__", replacement: `${config.outDir}/generated` },
      ],
    },
  });
}
