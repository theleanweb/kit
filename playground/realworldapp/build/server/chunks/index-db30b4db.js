import { c as create_ssr_component, v as validate_component, a as add_attribute, e as escape } from './ssr-32dfd25c.js';
import Component$1 from './layout-714d7918.js';
import Component$2 from './header-648813f3.js';

const Component = create_ssr_component(($$result, $$props, $$bindings, slots) => {
  let { user } = $$props;
  const bio = user?.bio || "";
  if ($$props.user === void 0 && $$bindings.user && user !== void 0)
    $$bindings.user(user);
  return `${validate_component(Component$1, "Layout").$$render($$result, {}, {}, {
    default: () => {
      return `${validate_component(Component$2, "Header").$$render($$result, { user }, {}, {})} <div class="settings-page"><div class="container page"><div class="row"><div class="col-md-6 offset-md-3 col-xs-12"><h1 class="text-xs-center">Your Settings</h1> <form><fieldset><fieldset class="form-group"><input class="form-control" type="text"${add_attribute("value", user?.image, 0)} placeholder="URL of profile picture"></fieldset> <fieldset class="form-group"><input class="form-control form-control-lg" type="text"${add_attribute("value", user?.username, 0)} placeholder="Your Name"></fieldset> <fieldset class="form-group"><textarea class="form-control form-control-lg" rows="8" placeholder="Short bio about you">${escape(bio, false)}</textarea></fieldset> <fieldset class="form-group"><input class="form-control form-control-lg" type="text" placeholder="Email"></fieldset> <fieldset class="form-group"><input class="form-control form-control-lg" type="password" placeholder="Password"></fieldset> <button type="submit" class="btn btn-lg btn-primary pull-xs-right">Update Settings</button></fieldset></form> <hr> <button class="btn btn-outline-danger">Or click here to logout.</button></div></div></div></div>`;
    }
  })}`;
});

export { Component as default };
//# sourceMappingURL=index-db30b4db.js.map
