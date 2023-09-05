import { c as create_ssr_component, b as each, e as escape } from './ssr-32dfd25c.js';

const Component = create_ssr_component(($$result, $$props, $$bindings, slots) => {
  let { count } = $$props;
  let { limit } = $$props;
  let { active } = $$props;
  const pages = Array.from(Array(Math.ceil(count / limit)).keys()).map((i) => i + 1);
  if ($$props.count === void 0 && $$bindings.count && count !== void 0)
    $$bindings.count(count);
  if ($$props.limit === void 0 && $$bindings.limit && limit !== void 0)
    $$bindings.limit(limit);
  if ($$props.active === void 0 && $$bindings.active && active !== void 0)
    $$bindings.active(active);
  return `<nav><ul class="pagination">${each(pages, (page) => {
    return `<li class="${"page-item " + escape(active === page ? "active" : "", true)}"><a class="page-link" href="">${escape(page)}</a> </li>`;
  })}</ul></nav>`;
});

export { Component as default };
//# sourceMappingURL=pagination-6b02c220.js.map
