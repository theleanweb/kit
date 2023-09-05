import { c as create_ssr_component, e as escape, a as add_attribute, v as validate_component } from './ssr-32dfd25c.js';
import Component$1 from './formatted-date-56d8a196.js';
import Component$3 from './tag-list-3a6c0760.js';
import Component$2 from './markup-52601bb5.js';
import 'marked';

const Component = create_ssr_component(($$result, $$props, $$bindings, slots) => {
  let { article } = $$props;
  if ($$props.article === void 0 && $$bindings.article && article !== void 0)
    $$bindings.article(article);
  return `<!DOCTYPE html> <html lang="en"><head><meta charset="UTF-8"> <meta name="viewport" content="width=device-width, initial-scale=1.0"> <link rel="stylesheet" href="//demo.productionready.io/main.css"> <title>Document</title></head> <body><div class="article-page"><div class="banner"><div class="container"><h1>${escape(article.title)}</h1> <div class="article-meta"><a href="${"/profile/" + escape(article.author.username, true)}"><img${add_attribute("src", article.author.image, 0)} alt="author avatar"></a> <div class="info"><a href="${"/profile/" + escape(article.author.username, true)}" class="author">${escape(article.author.username)}</a> ${validate_component(Component$1, "FormattedDate").$$render($$result, { date: article.createdAt }, {}, {})}</div> </div></div></div> <div class="container page"><div class="row article-content"><div class="col-xs-12"><p>${escape(article.description)}</p> ${validate_component(Component$2, "Markup").$$render($$result, { content: article.body }, {}, {})} ${validate_component(Component$3, "TagList").$$render($$result, { tags: article.tagList }, {}, {})}</div></div> <hr> </div></div></body></html>`;
});

export { Component as default };
//# sourceMappingURL=index7-f641283f.js.map
