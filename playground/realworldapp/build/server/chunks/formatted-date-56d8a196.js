import { c as create_ssr_component, e as escape } from './ssr-32dfd25c.js';

const Component = create_ssr_component(($$result, $$props, $$bindings, slots) => {
  let { date } = $$props;
  const formattedDate = new Intl.DateTimeFormat(
    "en-US",
    {
      year: "numeric",
      month: "long",
      day: "numeric"
    }
  ).format(new Date(date));
  if ($$props.date === void 0 && $$bindings.date && date !== void 0)
    $$bindings.date(date);
  return `<span class="date">${escape(formattedDate)}</span>`;
});

export { Component as default };
//# sourceMappingURL=formatted-date-56d8a196.js.map
