export type DeepImmutable<T> = T extends (...args: never[]) => unknown
  ? T
  : T extends readonly (infer U)[]
    ? readonly DeepImmutable<U>[]
    : T extends object
      ? { readonly [K in keyof T]: DeepImmutable<T[K]> }
      : T

export type DeepPartial<T> = T extends readonly (infer U)[]
  ? readonly DeepPartial<U>[]
  : T extends object
    ? { [K in keyof T]?: DeepPartial<T[K]> }
    : T

export type MaybePromise<T> = T | Promise<T>

