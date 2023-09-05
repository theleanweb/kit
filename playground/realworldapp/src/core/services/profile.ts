import { pipe } from "@effect/data/Function";
import * as Http from "http-kit";
import * as Res from "http-kit/response";
import type { Author } from "../models/author.js";

export async function getProfile(username: string) {
  return pipe(
    Http.get(`/profiles/${username}`, { cache: "no-store" }),
    Res.filterStatusOk(),
    Res.toJson<{ profile: Author }>()
  );
}
