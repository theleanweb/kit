import type { Interceptor } from "http-kit";
import { HttpRequest } from "http-kit/request";

import * as Effect from "@effect/io/Effect";

import { API_URL } from "$env/static/private";

function combineURLs(baseURL: string, relativeURL?: string) {
  return relativeURL
    ? baseURL.replace(/\/+$/, "") + "/" + relativeURL.replace(/^\/+/, "")
    : baseURL;
}

export const withApiUrl: Interceptor = {
  request(req) {
    const url = combineURLs(API_URL, req.url);
    return Effect.succeed(new HttpRequest(url, req.init));
  },
};
