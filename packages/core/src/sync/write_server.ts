import * as fs from "node:fs";
import { dedent } from "ts-dedent";

export async function write_server(output: string) {
  fs.writeFileSync(
    `${output}/internal.js`,
    dedent`
    export * from './views.js';
    export * from './config.js'
    `
  );
}
