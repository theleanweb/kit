import { c as create_ssr_component, a as add_attribute, e as escape, b as each } from './ssr-32dfd25c.js';

const Component = create_ssr_component(($$result, $$props, $$bindings, slots) => {
  let { comments } = $$props;
  let { user } = $$props;
  if ($$props.comments === void 0 && $$bindings.comments && comments !== void 0)
    $$bindings.comments(comments);
  if ($$props.user === void 0 && $$bindings.user && user !== void 0)
    $$bindings.user(user);
  return `${!user ? `<div class="row"><div class="col-xs-12 col-md-8 offset-md-2"><p><a href="/login">Sign in</a>
          or  
        <a href="/register">Sign up</a>
          to add comments on this article.</p></div></div>` : `<div class="row"><div class="col-xs-12 col-md-8 offset-md-2"><form class="card comment-form"><div class="card-block"><textarea name="comment" class="form-control" placeholder="Write a comment..."${add_attribute("rows", 3, 0)}></textarea></div> <div class="card-footer"><img${add_attribute("src", user.image, 0)} class="comment-author-img" alt="${escape(user.username, true) + " avatar"}"> <button type="submit" class="btn btn-sm btn-primary">Post Comment</button></div></form> ${comments ? `${each(comments, (comment) => {
    return `<div class="card"><div class="card-block"><p class="card-text">${escape(comment.body)}</p></div> <div class="card-footer"><a href="${"/profile/" + escape(comment.author.username, true)}" class="comment-author"><img${add_attribute("src", comment.author.image, 0)} class="comment-author-img" alt="${escape(comment.author.username, true) + " avatar"}"></a>
               
              <a href="${"/profile/" + escape(comment.author.username, true)}" class="comment-author">${escape(comment.author.username)}</a> <span class="date-posted">${escape(comment.createdAt)}</span> <span class="mod-options"><i class="ion-trash-a"></i> </span></div> </div>`;
  })}` : ``}</div></div>`}`;
});

export { Component as default };
//# sourceMappingURL=comment-list-ff525144.js.map
