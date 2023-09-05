import * as S from "@effect/schema/Schema";

export const Author = S.struct({
  bio: S.string,
  image: S.string,
  username: S.string,
  following: S.boolean,
});

export type Author = S.To<typeof Author>;
