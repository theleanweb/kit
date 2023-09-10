import { load } from "cheerio";
import { dedent } from "ts-dedent";

import * as A from "@effect/data/ReadonlyArray";
import * as Effect from "@effect/io/Effect";

import { options } from "__GENERATED__/config.js";
import { views } from "__GENERATED__/views.js";

import { VITE_HTML_CLIENT } from "../../utils/constants.js";
import { CompileError, coalesce_to_error } from "../../utils/error.js";
import { prepareError, template } from "./error.js";

class RenderError {
  readonly _tag = "RenderError";
  constructor(readonly module: string, readonly originalError: Error) {}
}

export async function render(
  view: string,
  props: object = {},
  init?: ResponseInit | undefined
) {
  const program = Effect.gen(function* ($) {
    const entries = [
      view,
      `${view}.html`,
      `${view}/index.html`,
      `${view}.md.html`,
      `${view}/index.md.html`,
    ];

    const entry = yield* $(A.findFirst(entries, (entry) => entry in views));

    const component = yield* $(
      Effect.tryPromise({
        try: () => views[entry](),
        catch: (e) => e as CompileError,
      })
    );

    const rendered = yield* $(
      Effect.try({
        try: () => component.render(props),
        catch: (e) => new RenderError(entry, coalesce_to_error(e)),
      })
    );

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

    return new Response(document.html(), {
      headers: { "Content-Type": "text/html" },
      ...init,
    });
  }).pipe(
    Effect.catchTag("NoSuchElementException", () => {
      const message = `View "${view}" not found in views directory`;

      const html = /* html */ `
      <!DOCTYPE html>
      <html lang="en">
        <head>
          <meta charset="UTF-8" />
          <title>View Not Found</title>
          ${__LEANWEB_DEV__ ? VITE_HTML_CLIENT : ""}
        </head>
        
        <body>
          <p>${message}</p>
        </body>
        
      </html>
      `;

      return Effect.succeed(
        new Response(html, {
          ...init,
          status: 404,
          headers: { "Content-Type": "text/html" },
        })
      );
    }),
    Effect.catchAll((e) => {
      let html: string;

      if (__LEANWEB_DEV__) {
        // To get around class instanceof check failing due to a vite problem
        if ("_tag" in e && e._tag === "CompileError") {
          html = template(e.originalError);
        } else {
          html = template(prepareError(e.originalError));
        }
      } else {
        html = `<pre style="word-wrap: break-word; white-space: pre-wrap;">Internal Server Error</pre>`;
      }

      return Effect.succeed(
        new Response(html, {
          ...init,
          status: 500,
          headers: { "Content-Type": "text/html" },
        })
      );
    })
  );

  return Effect.runPromise(program);
}
