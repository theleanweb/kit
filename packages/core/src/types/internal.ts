import { Config } from "../config/schema.js";

export interface SSRComponent {
  render(props: Record<string, any>): {
    html: string;
    head: string;
    css: { map: any; code: string };
  };
}

export interface Asset {
  file: string;
  size: number;
  type: string | null;
}

export interface View {
  file: string;
  name: string;
}

export interface BuildData {
  app_dir: string;
  assets: Asset[];
  app_path: string;
  service_worker: string | null;
}

export interface SSROptions {
  service_worker: boolean;
  env_private_prefix: string;
  templates: {
    error(values: { message: string; status: number }): string;
  };
}

export interface Env {
  private: Record<string, string>;
  public: Record<string, string>;
}

export interface Logger {
  (msg: string): void;
  success(msg: string): void;
  error(msg: string): void;
  warn(msg: string): void;
  minor(msg: string): void;
  info(msg: string): void;
}

/**
 * This object is passed to the `adapt` function of adapters.
 * It contains various methods and properties that are useful for adapting the app.
 */
export interface Builder {
  /** Print messages to the console. `log.info` and `log.minor` are silent unless Vite's `logLevel` is `info`. */
  log: Logger;

  /** Remove `dir` and all its contents. */
  rimraf(dir: string): void;

  /** Create `dir` and any required parent directories. */
  mkdirp(dir: string): void;

  /** The fully resolved `svelte.config.js`. */
  config: Config;

  /**
   * Resolve a path to the `name` directory inside `outDir`, e.g. `/path/to/.svelte-kit/my-adapter`.
   * @param name path to the file, relative to the build directory
   */
  getBuildDirectory(name: string): string;

  /** Get the fully resolved path to the directory containing client-side assets, including the contents of your `static` directory. */
  getClientDirectory(): string;

  /** Get the fully resolved path to the directory containing server-side code. */
  getServerDirectory(): string;

  /** Get the application path including any configured `base` path, e.g. `/my-base-path/_app`. */
  getAppPath(): string;

  /**
   * Write client assets to `dest`.
   * @param dest the destination folder
   * @returns an array of files written to `dest`
   */
  writeClient(dest: string): string[];

  /**
   * Write server-side code to `dest`.
   * @param dest the destination folder
   * @returns an array of files written to `dest`
   */
  writeServer(dest: string): string[];

  /**
   * Copy a file or directory.
   * @param from the source file or directory
   * @param to the destination file or directory
   * @param opts.filter a function to determine whether a file or directory should be copied
   * @param opts.replace a map of strings to replace
   * @returns an array of files that were copied
   */
  copy(
    from: string,
    to: string,
    opts?: {
      filter?(basename: string): boolean;
      replace?: Record<string, string>;
    }
  ): string[];

  /**
   * Compress files in `directory` with gzip and brotli, where appropriate. Generates `.gz` and `.br` files alongside the originals.
   * @param directory The directory containing the files to be compressed
   */
  compress(directory: string): Promise<void>;
}

export interface Adapter {
  /**
   * The name of the adapter, using for logging. Will typically correspond to the package name.
   */
  name: string;
  /**
   * This function is called after SvelteKit has built your app.
   * @param builder An object provided by SvelteKit that contains methods for adapting the app
   */
  adapt(builder: Builder): void | Promise<void>;
}
