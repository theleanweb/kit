import { RollupError } from "rollup";
import strip from "strip-ansi";

import { VITE_HTML_CLIENT } from "../../utils/constants.js";

export interface ErrorPayload {
  type: "error";
  err: {
    [name: string]: any;
    id?: string;
    stack: string;
    frame?: string;
    message: string;
    plugin?: string;
    pluginCode?: string;
    loc?: {
      line: number;
      file?: string;
      column: number;
    };
  };
}

function cleanStack(stack: string) {
  return stack
    .split(/\n/g)
    .filter((l) => /^\s*at/.test(l))
    .join("\n");
}

export function prepareError(err: Error | RollupError): ErrorPayload["err"] {
  // only copy the information we need and avoid serializing unnecessary
  // properties, since some errors may attach full objects (e.g. PostCSS)
  return {
    message: strip(err.message),
    stack: strip(cleanStack(err.stack || "")),
    id: (err as RollupError).id,
    frame: strip((err as RollupError).frame || ""),
    loc: (err as RollupError).loc,
  };
}

export const template = (err: ErrorPayload["err"]) => {
  const file = err.id ?? err.file ?? err.filename;

  return /*html*/ `
<!DOCTYPE html>
<html lang="en">

<head>
  <meta charset="UTF-8" />
  <title>Error</title>
  ${VITE_HTML_CLIENT}
  <style>
    :root {
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      z-index: 99999;
      --monospace: 'SFMono-Regular', Consolas,
        'Liberation Mono', Menlo, Courier, monospace;
      --red: #ff5555;
      --yellow: #e2aa53;
      --purple: #cfa4ff;
      --cyan: #2dd9da;
      --dim: #c9c9c9;

      --window-background: #181818;
      --window-color: #d8d8d8;
    }

    .backdrop {
      position: fixed;
      z-index: 99999;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      overflow-y: scroll;
      margin: 0;
      background: rgba(0, 0, 0, 0.66);
    }

    .window {
      font-family: var(--monospace);
      line-height: 1.5;
      width: 800px;
      color: var(--window-color);
      margin: 30px auto;
      padding: 25px 40px;
      position: relative;
      background: var(--window-background);
      border-radius: 6px 6px 8px 8px;
      box-shadow: 0 19px 38px rgba(0, 0, 0, 0.30), 0 15px 12px rgba(0, 0, 0, 0.22);
      overflow: hidden;
      border-top: 8px solid var(--red);
      direction: ltr;
      text-align: left;
    }

    pre {
      font-family: var(--monospace);
      font-size: 16px;
      margin-top: 0;
      margin-bottom: 1em;
      overflow-x: scroll;
      scrollbar-width: none;
    }

    pre::-webkit-scrollbar {
      display: none;
    }

    .message {
      line-height: 1.3;
      font-weight: 600;
      white-space: pre-wrap;
    }

    .message-body {
      color: var(--red);
    }

    .file {
      color: var(--cyan);
      margin-bottom: 0;
      white-space: pre-wrap;
      word-break: break-all;
    }

    .frame {
      color: var(--yellow);
    }

    .stack {
      font-size: 13px;
      color: var(--dim);
    }

    code {
      font-size: 13px;
      font-family: var(--monospace);
      color: var(--yellow);
    }

    .file-link {
      text-decoration: underline;
      cursor: pointer;
    }
  </style>
</head>

<body>
  <div class="backdrop">
    <div class="window">
      <pre class="message message-body">${err.message}</pre>
      ${
        file
          ? `
      <pre class="file">
            <a class="file-link" target="_blank" rel="noopener noreferrer" href="/__open-in-editor?file=${file}:${err.start?.line}:${err.start?.column}">${file}
            </a>
        </pre>`
          : ""
      }
      <pre class="frame">${err.frame}</pre>
      <pre class="stack">${err.stack}</pre>
    </div>
  </div>
</body>

</html>
`;
};
