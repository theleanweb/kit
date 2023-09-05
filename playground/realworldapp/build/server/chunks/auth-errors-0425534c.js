import { c as create_ssr_component, b as each, e as escape } from './ssr-32dfd25c.js';

const Component = create_ssr_component(($$result, $$props, $$bindings, slots) => {
  let { errors } = $$props;
  if ($$props.errors === void 0 && $$bindings.errors && errors !== void 0)
    $$bindings.errors(errors);
  return `<ul class="error-messages">${each(Object.entries(errors), ([field, fieldErrors]) => {
    return `${each(fieldErrors, (fieldError) => {
      return `<li>${escape(field)} ${escape(fieldError)} </li>`;
    })}`;
  })}</ul>`;
});

export { Component as default };
//# sourceMappingURL=auth-errors-0425534c.js.map
