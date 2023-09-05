import { c as create_ssr_component, v as validate_component, a as add_attribute, e as escape, b as each } from './ssr-32dfd25c.js';
import Component$1 from './layout-714d7918.js';
import Component$2 from './header-648813f3.js';
import Component$4 from './pagination-6b02c220.js';
import Component$3 from './article-preview-eb2d7202.js';
import './tag-list-3a6c0760.js';
import './formatted-date-56d8a196.js';
import './favorite-button-0a59c7e6.js';

const Component = create_ssr_component(($$result, $$props, $$bindings, slots) => {
  let { profile } = $$props;
  let { user } = $$props;
  let { activeTab } = $$props;
  let { articles } = $$props;
  let { articlesCount } = $$props;
  const ProfileTab = {
    MyArticles: "my-articles",
    FavoritedArticles: "favorited-articles"
  };
  const isAuthor = user && profile && user.username === profile.username;
  if ($$props.profile === void 0 && $$bindings.profile && profile !== void 0)
    $$bindings.profile(profile);
  if ($$props.user === void 0 && $$bindings.user && user !== void 0)
    $$bindings.user(user);
  if ($$props.activeTab === void 0 && $$bindings.activeTab && activeTab !== void 0)
    $$bindings.activeTab(activeTab);
  if ($$props.articles === void 0 && $$bindings.articles && articles !== void 0)
    $$bindings.articles(articles);
  if ($$props.articlesCount === void 0 && $$bindings.articlesCount && articlesCount !== void 0)
    $$bindings.articlesCount(articlesCount);
  return `${validate_component(Component$1, "Layout").$$render($$result, {}, {}, {
    default: () => {
      return `${validate_component(Component$2, "Header").$$render($$result, {}, {}, {})} <div class="profile-page"><div class="user-info"><div class="container"><div class="row"><div class="col-xs-12 col-md-10 offset-md-1"><img${add_attribute("src", profile.image, 0)} class="user-img" alt="profile avatar"> <h4>${escape(profile.username)}</h4> <p>${escape(profile.bio)}</p> ${isAuthor ? `<a href="/settings" class="btn btn-sm btn-outline-secondary action-btn"><i class="ion-gear-a"></i> Edit Profile Settings</a>` : ``} ${!isAuthor ? `` : ``}</div></div></div></div> <div class="container"><div class="row"><div class="col-xs-12 col-md-10 offset-md-1"><div class="articles-toggle"><ul class="nav nav-pills outline-active"><li class="nav-item"><a class="${"nav-link " + escape(activeTab === ProfileTab.MyArticles ? "active" : "", true)}" href="${"/profile?tab=" + escape(ProfileTab.MyArticles, true)}">My Articles</a></li> <li class="nav-item"><a class="${"nav-link " + escape(
        activeTab === ProfileTab.FavoritedArticles ? "active" : "",
        true
      )}" href="${"/profile?tab=" + escape(ProfileTab.FavoritedArticles, true)}">Favorited Articles</a></li></ul></div> ${articles ? `${articles.length === 0 ? `<div>No articles are here... yet.</div>` : `${each(articles, (article) => {
        return `${validate_component(Component$3, "ArticlePreview").$$render($$result, { article }, {}, {})}`;
      })}`} ${articlesCount > 10 ? `${validate_component(Component$4, "Pagination").$$render($$result, { count: articles.articlesCount, limit: 10 }, {}, {})}` : ``}` : ``}</div></div></div></div>`;
    }
  })}`;
});

export { Component as default };
//# sourceMappingURL=index3-7b779059.js.map
