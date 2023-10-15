import { VITE_HTML_CLIENT } from "../../utils/constants.js";

const font = `font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, 'Open Sans', 'Helvetica Neue', sans-serif;`;

export const notFound = ({
  dir,
  mode,
  view,
}: {
  dir: string;
  view: string;
  mode: "serve" | "build";
}) => /* html */ `
<!DOCTYPE html>
<html lang="en">

<head>
  <meta charset="UTF-8" />
  <title>View Not Found</title>
  ${mode == "serve" ? VITE_HTML_CLIENT : ""}
  <style>
    html,
    body {
      margin: 0;
      height: 100%;
      display: flex;
      flex-direction: column;
      ${font}
    }

    .container {
      width: 90%;
      margin: auto;
      display: flex;
      align-items: center;
      flex-direction: column;
    }

    .container>*+* {
      margin-top: 1rem;
    }

    .highlight {
        color: #fff;
        font-weight: 500;
        border-radius: 0.3rem;
        padding: 0.2rem 0.7rem;
        background-color: #333;
    }
  </style>
</head>

<body>
  <div class="container">
    <h1 style='text-align: center;'>View Not Found</h1>
    
    <div>
        <p><span class='highlight'>View:</span> ${view}</p>
        <p><span class='highlight'>Root:</span> ${dir}</p>
    </div>
  </div>
</body>

</html>
`;

export const serverError = /*html*/ `<pre style="word-wrap: break-word; white-space: pre-wrap;">Internal Server Error</pre>`;

const fileRE = /(?:[a-zA-Z]:\\|\/).*?:\d+:\d+/g;
const codeframeRE = /^(?:>?\s+\d+\s+\|.*|\s+\|\s*\^.*)\r?\n/gm;

export const viewError = (error: Error) => {
  console.log("file: ", error.stack ? fileRE.exec(error.stack) : "no stack");

  return /*html*/ `
<!DOCTYPE html>
<html lang="en">

<head>
  <meta charset="UTF-8" />
  <title>${error.name} | ${error.message}</title>
  ${VITE_HTML_CLIENT}
</head>

<body>
  <h4>${error.name}</h4>
  <h2>${error.message}</h2>
</body>

</html>
`;
};
