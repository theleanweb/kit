import type { Interceptor } from "http-kit";
import { HttpRequest } from "http-kit/request";

import * as Effect from "@effect/io/Effect";

export function withAuthToken(token: string): Interceptor {
  return {
    request(req) {
      const headers = new Headers(req.init.headers);
      headers.set("Authorization", `Token ${token}`);
      return Effect.succeed(new HttpRequest(req.url, { ...req.init, headers }));
    },
  };
}
