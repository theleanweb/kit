import path from "node:path";
import { Rollup } from "vite";
import { posixify } from "../../utils/filesystem.js";

const ILLEGAL_IMPORTS = new Set([
  "\0$env/dynamic/private",
  "\0$env/static/private",
]);

const ILLEGAL_MODULE_NAME_PATTERN = /\.html$/;

const strip_virtual_prefix = (id: string) => id.replace("\0virtual:", "");

/**
 * Checks if given id imports a module that is not allowed to be imported into client-side code.
 */
export function is_illegal(
  id: string,
  dirs: {
    cwd: string;
    node_modules: string;
  }
) {
  if (ILLEGAL_IMPORTS.has(id)) return true;

  if (!id.startsWith(dirs.cwd) || id.startsWith(dirs.node_modules))
    return false;

  return ILLEGAL_MODULE_NAME_PATTERN.test(path.basename(id));
}

/**
 * Creates a guard that checks that no id imports a module that is not allowed to be imported into client-side code.
 */
export function module_guard(
  context: Rollup.PluginContext,
  { cwd }: { cwd: string }
) {
  function follow(id: string, parents: string[]) {
    const module = context.getModuleInfo(id);

    if (module) {
      for (const child of module.importedIds) {
        if (ILLEGAL_IMPORTS.has(child)) {
          const imported_by_view = parents.find((_) =>
            ILLEGAL_MODULE_NAME_PATTERN.test(path.basename(_))
          );

          if (imported_by_view) {
            const env = strip_virtual_prefix(child);

            const message = [
              `Cannot import ${env} into client-side code: ${id}`,
              "- chain:",
              parents.join(",\n"),
            ];

            throw new Error(message.join("\n"));
          }
        }

        follow(child, [...parents, id]);
      }
    }
  }

  return {
    /** @param id should be posixified */
    check: (id: string) => {
      follow(id, []);
    },
  };
}

/**
 * Removes cwd/lib path from the start of the id
 */
export function normalize_id(id: string, lib: string, cwd: string) {
  //   if (id.startsWith(lib)) {
  //     id = id.replace(lib, "$lib");
  //   }

  if (id.startsWith(cwd)) {
    id = path.relative(cwd, id);
  }

  return posixify(id);
}
