import { createServer } from 'node:http';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import crypto from 'node:crypto';
import { existsSync, lstatSync, createReadStream } from 'fs';
import { env } from './env.js';
import server from './server/index.js';
import { dirname, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

// src/globals.ts
var webFetch = global.fetch;
if (typeof global.crypto === "undefined") {
  global.crypto = crypto;
}
global.fetch = (info, init) => {
  init = {
    // Disable compression handling so people can return the result of a fetch
    // directly in the loader without messing with the Content-Encoding header.
    compress: false,
    ...init
  };
  return webFetch(info, init);
};

// src/listener.ts
var getRequestListener = (fetchCallback) => {
  return async (incoming, outgoing) => {
    const method = incoming.method || "GET";
    const url = `http://${incoming.headers.host}${incoming.url}`;
    const headerRecord = [];
    const len = incoming.rawHeaders.length;
    for (let i = 0; i < len; i += 2) {
      headerRecord.push([incoming.rawHeaders[i], incoming.rawHeaders[i + 1]]);
    }
    const init = {
      method,
      headers: headerRecord
    };
    if (!(method === "GET" || method === "HEAD")) {
      init.body = Readable.toWeb(incoming);
      init.duplex = "half";
    }
    let res;
    try {
      res = await fetchCallback(new Request(url.toString(), init));
    } catch (e) {
      res = new Response(null, { status: 500 });
      if (e instanceof Error) {
        if (e.name === "TimeoutError" || e.constructor.name === "TimeoutError") {
          res = new Response(null, { status: 504 });
        }
      }
    }
    const contentType = res.headers.get("content-type") || "";
    const buffering = res.headers.get("x-accel-buffering") || "";
    const contentEncoding = res.headers.get("content-encoding");
    const contentLength = res.headers.get("content-length");
    const transferEncoding = res.headers.get("transfer-encoding");
    for (const [k, v] of res.headers) {
      if (k === "set-cookie") {
        outgoing.setHeader(k, res.headers.getSetCookie(k));
      } else {
        outgoing.setHeader(k, v);
      }
    }
    outgoing.statusCode = res.status;
    if (res.body) {
      try {
        if (contentEncoding || transferEncoding || contentLength || /^no$/i.test(buffering) || !/^(application\/json\b|text\/(?!event-stream\b))/i.test(contentType)) {
          await pipeline(Readable.fromWeb(res.body), outgoing);
        } else {
          const text = await res.text();
          outgoing.setHeader("Content-Length", Buffer.byteLength(text));
          outgoing.end(text);
        }
      } catch (e) {
        console.error(e);
        const err = e instanceof Error ? e : new Error("unknown error", { cause: e });
        outgoing.destroy(err);
      }
    } else {
      outgoing.end();
    }
  };
};

// src/server.ts
var createAdaptorServer = (options) => {
  const fetchCallback = options.fetch;
  const requestListener = getRequestListener(fetchCallback);
  const createServer$1 = options.createServer || createServer;
  const server = createServer$1(options.serverOptions || {}, requestListener);
  return server;
};
var serve = (options, listeningListener) => {
  const server = createAdaptorServer(options);
  server.listen(options?.port ?? 3e3, options.hostname ?? "0.0.0.0", () => {
    const serverInfo = server.address();
    listeningListener && listeningListener(serverInfo);
  });
  return server;
};

// src/utils/filepath.ts
var getFilePath = (options) => {
  let filename = options.filename;
  let root = options.root || "";
  const defaultDocument = options.defaultDocument || "index.html";
  if (filename.endsWith("/")) {
    filename = filename.concat(defaultDocument);
  } else if (!filename.match(/\.[a-zA-Z0-9]+$/)) {
    filename = filename.concat("/" + defaultDocument);
  }
  filename = filename.replace(/^\.?\//, "");
  root = root.replace(/\/$/, "");
  let path = root ? root + "/" + filename : filename;
  path = path.replace(/^\.?\//, "");
  return path;
};

// src/utils/mime.ts
var getMimeType = (filename) => {
  const regexp = /\.([a-zA-Z0-9]+?)$/;
  const match = filename.match(regexp);
  if (!match)
    return;
  let mimeType = mimes[match[1]];
  if (mimeType && mimeType.startsWith("text") || mimeType === "application/json") {
    mimeType += "; charset=utf-8";
  }
  return mimeType;
};
var mimes = {
  aac: "audio/aac",
  abw: "application/x-abiword",
  arc: "application/x-freearc",
  avi: "video/x-msvideo",
  avif: "image/avif",
  av1: "video/av1",
  azw: "application/vnd.amazon.ebook",
  bin: "application/octet-stream",
  bmp: "image/bmp",
  bz: "application/x-bzip",
  bz2: "application/x-bzip2",
  csh: "application/x-csh",
  css: "text/css",
  csv: "text/csv",
  doc: "application/msword",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  eot: "application/vnd.ms-fontobject",
  epub: "application/epub+zip",
  gif: "image/gif",
  gz: "application/gzip",
  htm: "text/html",
  html: "text/html",
  ico: "image/x-icon",
  ics: "text/calendar",
  jar: "application/java-archive",
  jpeg: "image/jpeg",
  jpg: "image/jpeg",
  js: "text/javascript",
  json: "application/json",
  jsonld: "application/ld+json",
  map: "application/json",
  mid: "audio/x-midi",
  midi: "audio/x-midi",
  mjs: "text/javascript",
  mp3: "audio/mpeg",
  mp4: "video/mp4",
  mpeg: "video/mpeg",
  mpkg: "application/vnd.apple.installer+xml",
  odp: "application/vnd.oasis.opendocument.presentation",
  ods: "application/vnd.oasis.opendocument.spreadsheet",
  odt: "application/vnd.oasis.opendocument.text",
  oga: "audio/ogg",
  ogv: "video/ogg",
  ogx: "application/ogg",
  opus: "audio/opus",
  otf: "font/otf",
  pdf: "application/pdf",
  php: "application/php",
  png: "image/png",
  ppt: "application/vnd.ms-powerpoint",
  pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  rtf: "application/rtf",
  sh: "application/x-sh",
  svg: "image/svg+xml",
  swf: "application/x-shockwave-flash",
  tar: "application/x-tar",
  tif: "image/tiff",
  tiff: "image/tiff",
  ts: "video/mp2t",
  ttf: "font/ttf",
  txt: "text/plain",
  vsd: "application/vnd.visio",
  webm: "video/webm",
  weba: "audio/webm",
  webp: "image/webp",
  woff: "font/woff",
  woff2: "font/woff2",
  xhtml: "application/xhtml+xml",
  xls: "application/vnd.ms-excel",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  xml: "application/xml",
  xul: "application/vnd.mozilla.xul+xml",
  zip: "application/zip",
  "3gp": "video/3gpp",
  "3g2": "video/3gpp2",
  "7z": "application/x-7z-compressed",
  gltf: "model/gltf+json",
  glb: "model/gltf-binary"
};

// src/serve-static.ts
var createStreamBody = (stream) => {
  const body = new ReadableStream({
    start(controller) {
      stream.on("data", (chunk) => {
        controller.enqueue(chunk);
      });
      stream.on("end", () => {
        controller.close();
      });
    },
    cancel() {
      stream.destroy();
    }
  });
  return body;
};
var serveStatic = (options = { root: "" }) => {
  return async (c, next) => {
    if (c.finalized)
      return next();
    const url = new URL(c.req.url);
    const filename = options.path ?? decodeURIComponent(url.pathname);
    let path = getFilePath({
      filename: options.rewriteRequestPath ? options.rewriteRequestPath(filename) : filename,
      root: options.root,
      defaultDocument: options.index ?? "index.html"
    });
    path = `./${path}`;
    if (!existsSync(path)) {
      return next();
    }
    const mimeType = getMimeType(path);
    if (mimeType) {
      c.header("Content-Type", mimeType);
    }
    const stat = lstatSync(path);
    const size = stat.size;
    if (c.req.method == "HEAD" || c.req.method == "OPTIONS") {
      c.header("Content-Length", size.toString());
      c.status(200);
      return c.body(null);
    }
    const range = c.req.header("range") || "";
    if (!range) {
      c.header("Content-Length", size.toString());
      return c.body(createStreamBody(createReadStream(path)), 200);
    }
    c.header("Accept-Ranges", "bytes");
    c.header("Date", stat.birthtime.toUTCString());
    let start = 0;
    let end = stat.size - 1;
    const parts = range.replace(/bytes=/, "").split("-");
    start = parseInt(parts[0], 10);
    end = parts[1] ? parseInt(parts[1], 10) : end;
    if (size < end - start + 1) {
      end = size - 1;
    }
    const chunksize = end - start + 1;
    const stream = createReadStream(path, { start, end });
    c.header("Content-Length", chunksize.toString());
    c.header("Content-Range", `bytes ${start}-${end}/${stat.size}`);
    return c.body(createStreamBody(stream), 206);
  };
};

const path = env("SOCKET_PATH", false);
const host = env("HOST", "0.0.0.0");
const port = env("PORT", !path && "3000");

const dir = dirname(fileURLToPath(import.meta.url));

const assets = relative(process.cwd(), resolve(dir, "./client"));

server.use("/*", serveStatic({ root: assets }));

const handle = serve(server);

handle.listen({ path, host, port }, () => {
  console.log(`Listening on ${path ? path : host + ":" + port}`);
});

export { host, path, port, handle as server };
