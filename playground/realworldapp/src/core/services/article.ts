import { pipe } from "effect/Function";
import * as Http from "http-kit";
import * as Res from "http-kit/response";
import type { Article } from "../models/article.js";

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
    Res.filterStatusOk,
    Res.toJson
  );
}

export function getArticle(slug: string) {
  return pipe(Http.get(`/articles/${slug}`), Res.filterStatusOk, Res.toJson);
}

export function getPersonalFeed({ offset, limit }: SearchParams) {
  return pipe(
    Http.get("/articles/feed", {
      search: Http.searchParams({
        limit: (limit || "10").toString(),
        offset: (offset || "0").toString(),
      }),
    }),
    Res.filterStatusOk,
    Res.toJson
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
