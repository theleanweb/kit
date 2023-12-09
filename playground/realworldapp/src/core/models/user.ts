import { pipe } from "effect/Function";
import * as S from "@effect/schema/Schema";

export const User = S.struct({
  email: S.string,
  image: S.string,
  token: S.string,
  username: S.string,
  bio: pipe(S.string, S.nullable),
});

export type User = S.Schema.To<typeof User>;
