import { IncomingMessage, ServerResponse } from "node:http";
import * as set_cookie_parser from "set-cookie-parser";

export class HttpError {
  constructor(
    readonly status: number,
    readonly body: { message: string } | string
  ) {
    this.status = status;
    if (typeof body === "string") {
      this.body = { message: body };
    } else if (body) {
      this.body = body;
    } else {
      this.body = { message: `Error: ${status}` };
    }
  }

  toString() {
    return JSON.stringify(this.body);
  }
}

/**
 * Creates an `HttpError` object with an HTTP status code and an optional message.
 * This object, if thrown during request handling, will cause SvelteKit to
 * return an error response without invoking `handleError`.
 * Make sure you're not catching the thrown error, which would prevent SvelteKit from handling it.
 * @param status The [HTTP status code](https://developer.mozilla.org/en-US/docs/Web/HTTP/Status#client_error_responses). Must be in the range 400-599.
 * @param body An object that conforms to the App.Error type. If a string is passed, it will be used as the message property.
 */
export function error(status: number, body: { message: string } | string) {
  return new HttpError(status, body);
}

function get_raw_body(req: IncomingMessage, body_size_limit?: number) {
  const h = req.headers;

  if (!h["content-type"]) return null;

  const content_length = Number(h["content-length"]);

  // check if no request body
  if (
    (req.httpVersionMajor === 1 &&
      isNaN(content_length) &&
      h["transfer-encoding"] == null) ||
    content_length === 0
  ) {
    return null;
  }

  let length = content_length;

  if (body_size_limit) {
    if (!length) {
      length = body_size_limit;
    } else if (length > body_size_limit) {
      throw error(
        413,
        `Received content-length of ${length}, but only accept up to ${body_size_limit} bytes.`
      );
    }
  }

  if (req.destroyed) {
    const readable = new ReadableStream();
    readable.cancel();
    return readable;
  }

  let size = 0;
  let cancelled = false;

  return new ReadableStream({
    start(controller) {
      req.on("error", (error) => {
        cancelled = true;
        controller.error(error);
      });

      req.on("end", () => {
        if (cancelled) return;
        controller.close();
      });

      req.on("data", (chunk) => {
        if (cancelled) return;

        size += chunk.length;

        if (size > length) {
          cancelled = true;

          controller.error(
            error(
              413,
              `request body size exceeded ${
                content_length ? "'content-length'" : "BODY_SIZE_LIMIT"
              } of ${length}`
            )
          );
          return;
        }

        controller.enqueue(chunk);

        if (controller.desiredSize === null || controller.desiredSize <= 0) {
          req.pause();
        }
      });
    },

    pull() {
      req.resume();
    },

    cancel(reason) {
      cancelled = true;
      req.destroy(reason);
    },
  });
}

export async function getRequest({
  request,
  base,
  bodySizeLimit,
}: {
  base: string;
  bodySizeLimit?: number;
  request: IncomingMessage;
}) {
  return new Request(base + request.url, {
    // @ts-expect-error
    duplex: "half",
    method: request.method,
    body: get_raw_body(request, bodySizeLimit),
    headers: request.headers as Record<string, string>,
  });
}

export async function setResponse(res: ServerResponse, response: Response) {
  for (const [key, value] of response.headers) {
    try {
      res.setHeader(
        key,
        key === "set-cookie"
          ? set_cookie_parser.splitCookiesString(
              response.headers.get(key) as string
            )
          : value
      );
    } catch (error) {
      res.getHeaderNames().forEach((name) => res.removeHeader(name));
      res.writeHead(500).end(String(error));
      return;
    }
  }

  res.writeHead(response.status);

  if (!response.body) {
    res.end();
    return;
  }

  if (response.body.locked) {
    res.end(
      "Fatal error: Response body is locked. " +
        "This can happen when the response was already read (for example through 'response.json()' or 'response.text()')."
    );
    return;
  }

  const reader = response.body.getReader();

  if (res.destroyed) {
    reader.cancel();
    return;
  }

  const cancel = (error?: Error) => {
    res.off("close", cancel);
    res.off("error", cancel);

    // If the reader has already been interrupted with an error earlier,
    // then it will appear here, it is useless, but it needs to be catch.
    reader.cancel(error).catch(() => {});
    if (error) res.destroy(error);
  };

  res.on("close", cancel);
  res.on("error", cancel);

  next();
  async function next() {
    try {
      for (;;) {
        const { done, value } = await reader.read();

        if (done) break;

        if (!res.write(value)) {
          res.once("drain", next);
          return;
        }
      }
      res.end();
    } catch (error) {
      cancel(error instanceof Error ? error : new Error(String(error)));
    }
  }
}
