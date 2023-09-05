# Lean Web Kit

Toolkit for a lean web

## Features

- Hot Module Reload
- Use Svelte for templating with familiar express like router
- Scoped css, build your apps with reusable components
- Markdown support, MDX but for svelte ([link](https://mdsvex.com/))
- Typed templates with typescript out of the box
- Deploy anywhere, with adapters for different platforms. Currently supported Vercel and Node
- Build websites/apps with modern DX (bundling, minifying etc) without sacrificing the user experience
- Use only what you need, no unnecessary JavaScript sent to the client
- Modern SPA features by using Turbolinks, HTMX etc

## Examples

- [Basic app](/playground/basic)
- [Realworld app](/playground/realworldapp)

## Project structure

.
└── app/
    ├── src/
    │   ├── views - your view templates/
    │   │   ├── home.html
    │   │   └── about.html
    │   └── entry.ts - entry point for your application routes
    ├── leanweb.d.ts
    ├── vite.config.js
    ├── package.json
    └── tsconfig.json

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
git clone https://github.com/theleanweb/leanweb-kit-starter.git
cd leanweb-kit-starter
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
touch entry.ts
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
import {render} from 'leanweb-kit/runtime'

const app = new Router()

app.get('/', () => render('home', {/* your template data (props) */}))

// ...
```

## Rendering

```ts
// ...

app.get('/', () => render('home', {/* your template data (props) */}))

// or

app.get('/', () => render('home/index'))

// or

app.get('/', () => render('home/index.html'))
```