import { c as create_ssr_component } from './ssr-32dfd25c.js';
import { marked } from 'marked';

const Component = create_ssr_component(($$result, $$props, $$bindings, slots) => {
  let { content } = $$props;
  const markup = marked(content, {
    gfm: true,
    breaks: true,
    mangle: false,
    headerIds: false
  });
  if ($$props.content === void 0 && $$bindings.content && content !== void 0)
    $$bindings.content(content);
  return `<div>${markup}</div>`;
});

export { Component as default };
//# sourceMappingURL=markup-52601bb5.js.map
