import { Adapter } from "leanweb-kit";
import "./ambient.js";

declare global {
  const ENV_PREFIX: string;
}

interface AdapterOptions {
  out?: string;
  envPrefix?: string;
  polyfill?: boolean;
  precompress?: boolean;
}

export default function plugin(options?: AdapterOptions): Adapter;
