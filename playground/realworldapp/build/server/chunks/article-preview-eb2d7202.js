import { c as create_ssr_component, e as escape, a as add_attribute, v as validate_component } from './ssr-32dfd25c.js';
import Component$3 from './tag-list-3a6c0760.js';
import Component$1 from './formatted-date-56d8a196.js';
import Component$2 from './favorite-button-0a59c7e6.js';

const Component = create_ssr_component(($$result, $$props, $$bindings, slots) => {
  let { article } = $$props;
  if ($$props.article === void 0 && $$bindings.article && article !== void 0)
    $$bindings.article(article);
  return `<div class="article-preview"><div class="article-meta"><a href="${"/profile/" + escape(article.author.username, true)}"><img decoding="sync"${add_attribute("src", article.author.image, 0)} alt="author avatar"></a> <div class="info"><a href="${"/profile/" + escape(article.author.username, true)}" class="author">${escape(article.author.username)}</a> ${validate_component(Component$1, "FormattedDate").$$render($$result, { date: article.createdAt }, {}, {})}</div> ${validate_component(Component$2, "FavoriteButton").$$render($$result, { article }, {}, {})}</div> <a href="${"/articles/" + escape(article.slug, true)}" class="preview-link"><h1>${escape(article.title)}</h1> <p>${escape(article.description)}</p> <span>Read more...</span> ${validate_component(Component$3, "TagList").$$render($$result, { tags: article.tagList }, {}, {})}</a></div>`;
});

export { Component as default };
//# sourceMappingURL=article-preview-eb2d7202.js.map
