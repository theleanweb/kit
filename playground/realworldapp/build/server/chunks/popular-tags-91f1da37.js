import { c as create_ssr_component, b as each, e as escape } from './ssr-32dfd25c.js';
import { T as Tab } from './index-51fa7090.js';
import 'http-kit';
import 'http-kit/fetch';
import '@effect/data/Function';
import '@effect/data/Option';
import '@effect/io/Effect';
import '@effect/data/ReadonlyArray';
import 'http-kit/request';
import 'http-kit/response';
import 'http-kit/body';
import '@effect/schema/Schema';

const Component = create_ssr_component(($$result, $$props, $$bindings, slots) => {
  let { tags } = $$props;
  if ($$props.tags === void 0 && $$bindings.tags && tags !== void 0)
    $$bindings.tags(tags);
  return `<div class="sidebar"><p>Popular Tags</p> <div class="tag-list">${each(tags, (tag) => {
    return `<a href="${"/?tag=" + escape(tag, true) + "&tab=" + escape(Tab.Tag, true)}" class="tag-pill tag-default">${escape(tag)} </a>`;
  })}</div></div>`;
});

export { Component as default };
//# sourceMappingURL=popular-tags-91f1da37.js.map
