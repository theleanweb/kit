import { createCookieFactory } from "./cookies.js";
import { createSessionStorageFactory } from "./sessions.js";

export const createCookie = createCookieFactory({ sign, unsign });

export const createCookieSessionStorage =
  createCookieSessionStorageFactory(createCookie);

export const createSessionStorage = createSessionStorageFactory(createCookie);
