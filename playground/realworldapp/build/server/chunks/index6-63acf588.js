import { c as create_ssr_component, v as validate_component, a as add_attribute, e as escape, b as each } from './ssr-32dfd25c.js';
import Component$1 from './layout-714d7918.js';
import Component$2 from './header-648813f3.js';

const Component = create_ssr_component(($$result, $$props, $$bindings, slots) => {
  let { article } = $$props;
  let { user } = $$props;
  if ($$props.article === void 0 && $$bindings.article && article !== void 0)
    $$bindings.article(article);
  if ($$props.user === void 0 && $$bindings.user && user !== void 0)
    $$bindings.user(user);
  return `${validate_component(Component$1, "Layout").$$render($$result, {}, {}, {
    default: () => {
      return `${validate_component(Component$2, "Header").$$render($$result, { user }, {}, {})} <div class="editor-page"><div class="container page"><div class="row"><div class="col-md-10 offset-md-1 col-xs-12"><form><fieldset><fieldset class="form-group"><input type="text"${add_attribute("value", article.title, 0)} name="articleTitle" placeholder="Article Title" class="form-control form-control-lg"></fieldset> <fieldset class="form-group"><input type="text" name="description"${add_attribute("value", article.description, 0)} class="form-control" placeholder="What's this article about?"></fieldset> <fieldset class="form-group"><textarea rows="8" class="form-control" name="body" placeholder="Write your article (in markdown)">${escape(article.body, false)}</textarea></fieldset> <fieldset class="form-group"><input type="text" name="tags" class="form-control" placeholder="Enter tags"> <div class="tag-list">${each(article.tagList, (tag) => {
        return `<span class="tag-default tag-pill"${add_attribute("key", tag, 0)}><i class="ion-close-round"></i> ${escape(tag)} </span>`;
      })}</div></fieldset> <button type="button" class="btn btn-lg pull-xs-right btn-primary">Publish Article</button></fieldset></form></div></div></div></div>`;
    }
  })}`;
});

export { Component as default };
//# sourceMappingURL=index6-63acf588.js.map
