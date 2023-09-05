import { GENERATED_COMMENT } from "../../../utils/constants.js";
import { Env } from "../../../types/internal.js";
import { dedent } from "ts-dedent";

type EnvType = "public" | "private";

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
  {
    public_prefix,
    private_prefix,
  }: { public_prefix: string; private_prefix: string }
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

export const reserved = new Set([
  "do",
  "if",
  "in",
  "for",
  "let",
  "new",
  "try",
  "var",
  "case",
  "else",
  "enum",
  "eval",
  "null",
  "this",
  "true",
  "void",
  "with",
  "await",
  "break",
  "catch",
  "class",
  "const",
  "false",
  "super",
  "throw",
  "while",
  "yield",
  "delete",
  "export",
  "import",
  "public",
  "return",
  "static",
  "switch",
  "typeof",
  "default",
  "extends",
  "finally",
  "package",
  "private",
  "continue",
  "debugger",
  "function",
  "arguments",
  "interface",
  "protected",
  "implements",
  "instanceof",
]);

export const valid_identifier = /^[a-zA-Z_$][a-zA-Z0-9_$]*$/;
