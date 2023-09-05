import * as S from "@effect/schema/Schema";
import { Author } from "./author.js";

export const Article = S.struct({
  slug: S.string,
  body: S.string,
  author: Author,
  title: S.string,
  createdAt: S.string,
  updatedAt: S.string,
  favorited: S.boolean,
  description: S.string,
  favoritesCount: S.number,
  tagList: S.array(S.string),
});

export type Article = S.To<typeof Article>;
