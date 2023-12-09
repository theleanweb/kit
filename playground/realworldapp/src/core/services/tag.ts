import { pipe } from "effect/Function";
import * as Http from "http-kit";
import * as Res from "http-kit/response";

export function getPopularTags() {
  return pipe(Http.get("/tags"), Res.filterStatusOk, Res.toJson);
}
