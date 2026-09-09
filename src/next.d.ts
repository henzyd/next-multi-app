/**
 * `next` is a peer dependency and is not installed here. Only the configuration
 * type is referenced, so a structural stand-in is enough to type-check the
 * package on its own.
 */
declare module "next" {
  export interface NextConfig {
    [key: string]: unknown;
    outputFileTracingRoot?: string;
    headers?: () => Promise<
      Array<{
        source: string;
        headers: Array<{ key: string; value: string }>;
      }>
    >;
  }
}
