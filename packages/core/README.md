# Lean Web Kit

Toolkit for a lean web

> Build websites/apps with modern DX (bundling, minifying etc) without sacrificing the user experience. Use only what you need, no unnecessary JavaScript sent to the client

## Features

- Live Reload
- Templating with Svelte
- Scoped CSS
- Markdown and MDX support
- Build your apps with reusable components
- Typed templates with typescript out of the box
- Deploy anywhere, with adapters for different platforms. Currently supported Vercel and Node
- Modern SPA features by using Turbolinks, HTMX etc

## Examples

- [Basic app](/playground/basic)
- [Realworld app](/playground/realworldapp)

## Gotchas

- Templating is done using svelte, but template files must use the .html file extension instead of .svelte

- Markdown files must include .md in the filename e.g `about.md.html`

- Svelte client side reactivity is not supported, we only send plain-old-html to the client

- Imports in templates must always include the file extension. Writing

```html
<script>
  import Component from "./component"
  import Enum from './types/enum'
</script>
```

will not work, it has to be

```html
<script>
  import Component from "./component.html"
  import Enum from './types/enum.ts'
</script>
```

## Getting started

```bash
git clone https://github.com/theleanweb/kit-starter.git
cd kit-starter
npm i
npm run dev
```

### Manually

```bash
mkdir project-name
cd project-name
npm init -y
npm i leanweb-kit vite svelte
touch vite.config.js
```

> vite.config.js

```js
import {defineConfig} from 'vite';
import {leanweb} from 'leanweb-kit/vite';

export default defineConfig({
  plugins: [leanweb({/** ...config */})]
})
```

```bash
mkdir src
cd src
touch entry.js
mkdir views
touch home.html
```

> entry.ts

```js
import {Router} from 'leanweb-kit/runtime';

const app = new Router();

export default app
```

> package.json

```json
{
  // ...
  "scripts": {
    "dev": "vite dev",
    "build": "vite build",
    "preview": "vite preview"
  }
}
```

### Start

```bash
npm run dev
```

### Production

```bash
npm run build
```

### Preview production build

```bash
npm run preview
```

## Routing

[link](https://hono.dev/api/routing)

```ts
const app = new Router()

// GET /
app.get("/", () => new Response("Hello, world!"));

// DELETE /book/:title where :title is a route parameter
app.delete("/book/:title", async (ctx) => {
  // Parameters are available in ctx.params
  return new Response(`Deleted book: ${ctx.params.title}`);
});

// ...
```

## Rendering

```ts
import {view} from 'leanweb-kit/runtime'

// ...

app.get('/', (context) => view(context, 'home', {/* your template data (props) */}))

// or

app.get('/', (context) => view(context, 'home/index'))

// or

app.get('/', (context) => view(context, 'home/index.html'))
```