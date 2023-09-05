import { c as create_ssr_component, v as validate_component, e as escape, b as each } from './ssr-32dfd25c.js';
import Component$5 from './popular-tags-91f1da37.js';
import Component$3 from './article-preview-eb2d7202.js';
import Component$1 from './layout-714d7918.js';
import Component$2 from './header-648813f3.js';
import Component$4 from './pagination-6b02c220.js';
import { T as Tab } from './index-51fa7090.js';
import './tag-list-3a6c0760.js';
import './formatted-date-56d8a196.js';
import './favorite-button-0a59c7e6.js';
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
  let { user } = $$props;
  let { tab } = $$props;
  let { tags } = $$props;
  let { activeTag } = $$props;
  let { articles } = $$props;
  let { articlesCount } = $$props;
  if ($$props.user === void 0 && $$bindings.user && user !== void 0)
    $$bindings.user(user);
  if ($$props.tab === void 0 && $$bindings.tab && tab !== void 0)
    $$bindings.tab(tab);
  if ($$props.tags === void 0 && $$bindings.tags && tags !== void 0)
    $$bindings.tags(tags);
  if ($$props.activeTag === void 0 && $$bindings.activeTag && activeTag !== void 0)
    $$bindings.activeTag(activeTag);
  if ($$props.articles === void 0 && $$bindings.articles && articles !== void 0)
    $$bindings.articles(articles);
  if ($$props.articlesCount === void 0 && $$bindings.articlesCount && articlesCount !== void 0)
    $$bindings.articlesCount(articlesCount);
  return `${$$result.head += `${$$result.title = `<title>Home - Conduit</title>`, ""}`, ""} ${validate_component(Component$1, "Layout").$$render($$result, {}, {}, {
    default: () => {
      return `${validate_component(Component$2, "Header").$$render($$result, { user }, {}, {})} <div class="home-page">${!user ? `<div class="banner"><div class="container"><h1 class="logo-font">conduit</h1> <p>A place to share your knowledge.</p></div></div>` : ``} <div class="container page"><div class="row"><div class="col-md-9"><div class="feed-toggle"><ul class="nav nav-pills outline-active">${user ? `<li class="nav-item"><a href="/?tab=personal" class="${"nav-link " + escape(tab === Tab.Personal ? "active" : "", true)}">Your Feed</a></li>` : ``} <li class="nav-item"><a href="/?tab=global" class="${"nav-link " + escape(tab === Tab.Global ? "active" : "", true)}">Global Feed</a></li> ${activeTag ? `<li class="nav-item"><a class="${"nav-link " + escape(tab === Tab.Tag ? "active" : "", true)}" href="${"/?tag=" + escape(activeTag, true)}">#${escape(activeTag)}</a></li>` : ``}</ul></div> ${articles ? `${articles.length === 0 ? `<div>No articles are here... yet.</div>` : `${each(articles, (article) => {
        return `${validate_component(Component$3, "ArticlePreview").$$render($$result, { article }, {}, {})}`;
      })}`}` : ``} ${articlesCount > 10 ? `${validate_component(Component$4, "Pagination").$$render($$result, { count: articlesCount, limit: 10 }, {}, {})}` : ``}</div> <div class="col-md-3">${validate_component(Component$5, "PopularTags").$$render($$result, { tags }, {}, {})}</div></div></div></div>`;
    }
  })}`;
});

export { Component as default };
//# sourceMappingURL=index5-eeae1db6.js.map
