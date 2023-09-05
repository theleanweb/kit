export function coalesce_to_error(err: unknown) {
  return err instanceof Error ||
    (err && (err as any).name && (err as any).message)
    ? (err as Error)
    : new Error(JSON.stringify(err));
}

export class CompileError {
  readonly _tag = "CompileError";
  constructor(readonly originalError: any) {}
}

export class HTMLTransformError {
  readonly _tag = "HTMLTransformError";
  constructor(readonly originalError: any) {}
}
