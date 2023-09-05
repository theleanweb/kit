import { c as create_ssr_component, v as validate_component } from './ssr-32dfd25c.js';
import Component$4 from './field-2a11e225.js';
import Component$1 from './layout-714d7918.js';
import Component$2 from './header-648813f3.js';
import Component$3 from './auth-errors-0425534c.js';

const Component = create_ssr_component(($$result, $$props, $$bindings, slots) => {
  let { errors } = $$props;
  if ($$props.errors === void 0 && $$bindings.errors && errors !== void 0)
    $$bindings.errors(errors);
  return `${validate_component(Component$1, "Layout").$$render($$result, {}, {}, {
    default: () => {
      return `${validate_component(Component$2, "Header").$$render($$result, {}, {}, {})} <div class="auth-page"><div class="container page"><div class="row"><div class="col-md-6 offset-md-3 col-xs-12"><h1 class="text-xs-center">Sign up</h1> <p class="text-xs-center"><a href="/login">Have an account?</a></p> ${errors ? `${validate_component(Component$3, "AuthErrors").$$render($$result, { errors }, {}, {})}` : ``} <form action="/register" method="post">${validate_component(Component$4, "Field").$$render(
        $$result,
        {
          name: "username",
          type: "text",
          placeholder: "Username"
        },
        {},
        {}
      )} ${validate_component(Component$4, "Field").$$render(
        $$result,
        {
          name: "email",
          type: "text",
          placeholder: "Email"
        },
        {},
        {}
      )} ${validate_component(Component$4, "Field").$$render(
        $$result,
        {
          name: "password",
          type: "password",
          placeholder: "Password"
        },
        {},
        {}
      )} <button type="submit" class="btn btn-lg btn-primary pull-xs-right">Sign up</button></form></div></div></div></div>`;
    }
  })}`;
});

export { Component as default };
//# sourceMappingURL=index2-013724ca.js.map
