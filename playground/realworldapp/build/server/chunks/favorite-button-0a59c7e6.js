import { c as create_ssr_component, e as escape } from './ssr-32dfd25c.js';

const Component = create_ssr_component(($$result, $$props, $$bindings, slots) => {
  let { isExtended } = $$props;
  let { article } = $$props;
  const count = article.favoritesCount;
  const favorited = article.favorited;
  if ($$props.isExtended === void 0 && $$bindings.isExtended && isExtended !== void 0)
    $$bindings.isExtended(isExtended);
  if ($$props.article === void 0 && $$bindings.article && article !== void 0)
    $$bindings.article(article);
  return `${isExtended ? `<button class="${"btn btn-sm btn-" + escape(!favorited ? "outline-" : "", true) + "primary"}"><i class="ion-heart"></i> ${escape(favorited ? "Unfavorite" : "Favorite")} Article
		<span class="counter">(${escape(count)})</span></button>` : `<button class="${"btn btn-sm btn-" + escape(!favorited ? "outline-" : "", true) + "primary pull-xs-right"}"><i class="ion-heart"></i> ${escape(count)}</button>`}`;
});

export { Component as default };
//# sourceMappingURL=favorite-button-0a59c7e6.js.map
