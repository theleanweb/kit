import { load } from "cheerio";
import { dedent } from "ts-dedent";

import type { Context } from "hono";

import * as A from "effect/ReadonlyArray";
import * as Effect from "effect/Effect";
import { pipe } from "effect/Function";
import { NoSuchElementException } from "effect/Cause";

import options from "__GENERATED__/config.js";
import { views } from "__GENERATED__/views.js";

import { SSRComponent } from "../../types/internal.js";
import { VITE_HTML_CLIENT } from "../../utils/constants.js";
import { CompileError, coalesce_to_error } from "../../utils/error.js";
import { prepareError, template } from "./error.js";
import { notFound, serverError } from "./templates.js";

class RenderError {
  readonly _tag = "RenderError";
  constructor(readonly module: string, readonly cause: Error) {}
}

export function renderComponent(component: SSRComponent, props: object = {}) {
  const rendered = component.render(props);

  const document = load(rendered.html);
  const head = document("head");

  head.append(rendered.head);

  if (rendered.css.code) {
    head.append(`<style>${rendered.css.code}</style>`);
  }

  if (__LEANWEB_DEV__) {
    head.append(VITE_HTML_CLIENT);
  }

  if (options.service_worker) {
    const opts = __LEANWEB_DEV__ ? ", { type: 'module' }" : "";

    document("body").append(dedent`
    <script>
    if ('serviceWorker' in navigator) {
      addEventListener('load', function() {
        navigator.serviceWorker.register('service-worker.js'${opts});
      });
    }
    </script>`);
  }

  return document.html();
}

export function render(
  view: string,
  props: object = {}
): Effect.Effect<
  never,
  NoSuchElementException | CompileError | RenderError,
  string
> {
  return Effect.gen(function* ($) {
    const component = yield* $(
      Effect.tryPromise({
        try: () => views[view](),
        catch: (e) => e as CompileError,
      })
    );

    return yield* $(
      Effect.try({
        try: () => renderComponent(component, props),
        catch: (e) => new RenderError(view, coalesce_to_error(e)),
      })
    );
  });
}

export function view(
  context: Context,
  view: string,
  props: object = {},
  init?: ResponseInit
) {
  return pipe(
    render(view, props),
    Effect.map((html) => context.html(html, init)),
    Effect.catchTag("NoSuchElementException", () => {
      const html = notFound({
        view,
        dir: options.files.views,
        mode: __LEANWEB_DEV__ ? "serve" : "build",
      });

      return Effect.succeed(context.html(html, { status: 404 }));
    }),
    Effect.catchAll((e) => {
      let html: string;

      // console.log(e.cause);
      // console.log(e.cause, viewError(e.cause));

      if (__LEANWEB_DEV__) {
        // To get around class instanceof check failing due to a vite problem
        if ("_tag" in e && e._tag === "CompileError") {
          html = template(e.cause);
        } else {
          html = template(prepareError(e.cause));
        }
      } else {
        html = serverError;
      }

      return Effect.succeed(context.html(html, { status: 500 }));
    }),
    Effect.runPromise
  );
}

export function viewToString(view: string, props: object = {}) {
  return Effect.runPromise(render(view, props));
}
