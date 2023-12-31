import { load } from "cheerio";
import { dedent } from "ts-dedent";

import type { Context } from "hono";

import config from "__GENERATED__/config.js";
import { views } from "__GENERATED__/views.js";

import { SSRComponent } from "../../types/internal.js";
import { VITE_HTML_CLIENT } from "../../utils/constants.js";
import { notFound } from "./templates.js";

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

  if (config.serviceWorker.register) {
    const opts = __LEANWEB_DEV__ ? ", { type: 'module' }" : "";

    document("body").append(dedent/*html*/ `
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

export async function render(view: string, props: object = {}) {
  const component = await views[view]();
  return renderComponent(component, props);
}

export async function view(
  context: Context,
  view: string,
  props: object = {},
  init?: ResponseInit
) {
  const entry = views[view];

  if (!entry) {
    let html = "Not found";

    if (__LEANWEB_DEV__) {
      html = notFound({ view, mode: "serve", dir: config.files.views });
    }

    return context.html(html, { status: 404 });
  }

  let component = await entry();

  const html = renderComponent(component, props);
  return context.html(html, init);
}

export function viewToString(view: string, props: object = {}) {
  return render(view, props);
}
