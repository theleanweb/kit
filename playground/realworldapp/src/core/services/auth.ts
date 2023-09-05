import { pipe } from "@effect/data/Function";
import * as Http from "http-kit";
import { json } from "http-kit/body";
import * as Res from "http-kit/response";
import { User } from "../models/user.js";
import * as S from "@effect/schema/Schema";
import * as Effect from "@effect/io/Effect";

interface LoginCredentials {
  email: string;
  password: string;
}

interface RegisterCredentials {
  email: string;
  username: string;
  password: string;
}

interface ErrorResponse {
  errors: { [K: string]: string[] };
}

export function login(credentials: LoginCredentials) {
  return pipe(
    Http.post("/users/login", json({ user: credentials })),
    Res.filterStatusOk(),
    Res.toJson<{ user: User }>(),
    Effect.catchTag("StatusError", (e) => {
      return pipe(
        Effect.tryPromise({
          try: () => e.response.json() as Promise<ErrorResponse>,
          catch: () => new Error("JSONDecodeError"),
        }),
        Effect.flatMap(Effect.fail),
      );
    }),
  );
}

export function register(credentials: RegisterCredentials) {
  return pipe(
    Http.post("/users", json({ user: credentials })),
    Res.filterStatusOk(),
    Res.toJson<{ user: User }>(),
    Effect.catchTag("StatusError", (e) => {
      return pipe(
        Effect.tryPromise({
          try: () => e.response.json() as Promise<ErrorResponse>,
          catch: () => new Error("JSONDecodeError"),
        }),
        Effect.flatMap(Effect.fail),
      );
    }),
  );
}

export function getCurrentUser() {
  return pipe(
    Http.get("/user"),
    Res.filterStatusOk(),
    Res.toJson(),
    S.parse(User),
  );
}

export function updateUser(user: unknown) {
  return pipe(
    Http.put("/user", json({ user })),
    Res.filterStatusOk(),
    Res.toJson<{ user: User }>(),
  );
}
