import { c as create_ssr_component, a as add_attribute } from './ssr-32dfd25c.js';

const Component = create_ssr_component(($$result, $$props, $$bindings, slots) => {
  let { name } = $$props;
  let { type } = $$props;
  let { placeholder } = $$props;
  if ($$props.name === void 0 && $$bindings.name && name !== void 0)
    $$bindings.name(name);
  if ($$props.type === void 0 && $$bindings.type && type !== void 0)
    $$bindings.type(type);
  if ($$props.placeholder === void 0 && $$bindings.placeholder && placeholder !== void 0)
    $$bindings.placeholder(placeholder);
  return `<fieldset class="form-group"><input${add_attribute("name", name, 0)} class="form-control form-control-lg"${add_attribute("type", type, 0)}${add_attribute("placeholder", placeholder, 0)}></fieldset>`;
});

export { Component as default };
//# sourceMappingURL=field-2a11e225.js.map
