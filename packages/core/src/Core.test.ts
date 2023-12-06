import { fs } from "memfs";

import { expect, test, beforeEach } from "vitest";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Runtime from "effect/Runtime";
import * as Option from "effect/Option";

import { PlatformError } from "@effect/platform/Error";
import * as PlatformFileSystem from "@effect/platform/FileSystem";
import * as NodeFileSystem from "@effect/platform-node/FileSystem";

import { Entry, Config } from "./Core.js";
import { ValidatedConfig, Config as Schema } from "./Config/schema.js";
import { FileSystem } from "./FileSystem.js";

const noop = () => Effect.succeed(void 0);

// const NodeFileSystem = Layer.effect(
//   PlatformFileSystem.FileSystem,
//   Effect.gen(function* (_) {
//     return PlatformFileSystem.FileSystem.of({
//       access: noop,
//       chmod: noop,
//       chown: noop,
//       copy: noop,
//       copyFile: noop,
//       exists: () => Effect.succeed(true),
//       link: noop,
//       makeDirectory: noop,
//       makeTempDirectory: () => Effect.succeed(""),
//       makeTempDirectoryScoped: () => Effect.succeed(""),
//       makeTempFile: () => Effect.succeed(""),
//       makeTempFileScoped: () => Effect.succeed(""),
//       open: (...args) =>
//         Effect.async((resume) => {
//           fs.open(...args, (err, v) => {});
//         }),
//       readDirectory: () => Effect.succeed([] as string[]),
//       readFile: () => Effect.succeed(new Uint8Array()),
//       readFileString: () => Effect.succeed(""),
//       readLink: () => Effect.succeed(""),
//       realPath: () => Effect.succeed(""),
//       remove: () => Effect.succeed(void 0),
//       rename: () => Effect.succeed(void 0),
//       stat: (...args) => {
//         return Effect.try({
//           try: () => fs.statSync(...args),
//           catch: (e) => e as PlatformError,
//         });
//       },
//       symlink: () => Effect.succeed(void 0),
//       truncate: () => Effect.succeed(""),
//       writeFile: noop,
//       utimes: noop,
//       writeFileString: noop,
//     });
//   })
// );

const FileSystemLive = Layer.effect(
  FileSystem,
  Effect.gen(function* (_) {
    const fs = yield* _(PlatformFileSystem.FileSystem);

    return {
      ...fs,
      glob(...args) {
        return Effect.succeed([]);
      },
    };
  })
);

const CoreFileSystem = FileSystemLive.pipe(Layer.use(NodeFileSystem.layer));

const config: Schema = {
  files: {
    entry: "src/entry.ts",
    views: "src/views",
  },
};

let core: Effect.Effect.Success<typeof Entry>;

const layer = Layer.mergeAll(
  Layer.succeed(Config, config as any),
  NodeFileSystem.layer,
  CoreFileSystem
);

const runtime = Layer.toRuntime(layer).pipe(Effect.scoped, Effect.runSync);

const runFork = Runtime.runFork(runtime);
const runSync = Runtime.runSync(runtime);
const runPromise = Runtime.runPromise(runtime);

beforeEach(async () => {
  core = await runPromise(Entry);
});

test("resolve server entry", async () => {
  const server = await runPromise(core.server);
  expect(Option.isSome(server)).toBeTruthy();
});

test("resolve views", async () => {
  const views = await runPromise(core.views);
  expect(views).toEqual([{ name: "", file: "" }]);
});

test("resolve static files in public directory", async () => {
  const assets = await runPromise(core.assets);
  expect(assets).toEqual([{ type: "", file: "favicon.ico", size: 0 }]);
});
