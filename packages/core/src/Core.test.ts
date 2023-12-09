import { fileURLToPath } from "node:url";

import {
  createGlobInterceptor,
  fromNodeLikeFileSystem,
} from "glob-interceptor";
import { Volume, vol } from "memfs";

import { beforeEach, expect, test } from "vitest";

import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Option from "effect/Option";
import * as Runtime from "effect/Runtime";

import * as NodeFileSystem from "@effect/platform-node/FileSystem";
import * as PlatformFileSystem from "@effect/platform/FileSystem";

import { glob } from "glob";

import { Config as Schema } from "./Config/schema.js";
import { Config, Entry } from "./Core.js";
import { FileSystem } from "./FileSystem.js";

const files = {
  "./entry.js": "",
  "./static/favicon.ico": "",
  "./src/views/empty.html": "",
};

vol.fromJSON(files);

const interceptor = createGlobInterceptor(
  fromNodeLikeFileSystem(Volume.fromJSON(files))
);

const FileSystemLive = Layer.effect(
  FileSystem,
  Effect.gen(function* (_) {
    const fs = yield* _(PlatformFileSystem.FileSystem);

    return {
      ...fs,
      glob(pattern, options) {
        return Effect.tryPromise({
          try: () => glob(pattern, { ...options, ...interceptor }),
          catch: (e) => e as Error,
        });
      },
    };
  })
);

const CoreFileSystem = FileSystemLive.pipe(
  Layer.useMerge(NodeFileSystem.layer)
);

const views = fileURLToPath(new URL("./fixtures/src/views", import.meta.url));
const assets = fileURLToPath(new URL("./fixtures/static", import.meta.url));
const entry = fileURLToPath(new URL("./fixtures/entry.js", import.meta.url));

const config: Schema = { files: { entry, views, assets } };

let core: Effect.Effect.Success<typeof Entry>;

const layer = Layer.mergeAll(
  Layer.succeed(Config, config as any),
  CoreFileSystem
);

const runtime = Layer.toRuntime(layer).pipe(Effect.scoped, Effect.runSync);
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
  expect(views.map((_) => _.name)).toEqual(["home.html"]);
});

test("resolve static files in public directory", async () => {
  const assets = await runPromise(core.assets);
  expect(assets.map((_) => _.file)).toEqual(["favicon.ico"]);
});
