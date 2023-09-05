import { pipe } from "@effect/data/Function";
import * as Http from "http-kit";
import * as Res from "http-kit/response";
import type { Article } from "../models/article.js";
import * as Effect from "@effect/io/Effect";

interface SearchParams {
  limit?: number;
  offset?: number;
  author?: string;
  favorited?: string;
  tag?: string | null;
}

export function getArticles({
  offset,
  author,
  tag,
  favorited,
  limit,
}: SearchParams) {
  return pipe(
    Http.get("/articles", {
      search: Http.searchParams({
        limit: (limit || "10").toString(),
        offset: (offset || "0").toString(),
        ...(author ? { author } : {}),
        ...(tag ? { tag } : {}),
        ...(favorited ? { favorited } : {}),
      }),
    }),
    Res.filterStatusOk(),
    Res.toJson<{ articles: Array<Article>; articlesCount: number }>()
  );
}

export function getArticle(slug: string) {
  return pipe(
    Http.get(`/articles/${slug}`),
    Res.filterStatusOk(),
    Res.toJson<{ article: Article }>()
  );
}

export function getPersonalFeed({ offset, limit }: SearchParams) {
  return pipe(
    Http.get("/articles/feed", {
      search: Http.searchParams({
        limit: (limit || "10").toString(),
        offset: (offset || "0").toString(),
      }),
    }),
    Res.filterStatusOk(),
    Res.toJson<{ articles: Array<Article>; articlesCount: number }>()
    // Effect.catchTag("StatusError", (e) => {
    //   return pipe(
    //     Effect.tryPromise({
    //       try: () => e.response.json(),
    //       catch: () => new Error("JSONDecodeError"),
    //     }),
    //     Effect.flatMap(Effect.fail)
    //   );
    // })
  );
}
