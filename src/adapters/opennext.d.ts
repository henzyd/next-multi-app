/**
 * Minimal declaration so this package type-checks without depending on
 * `@opennextjs/cloudflare`. Repositories using the Cloudflare adapter install
 * the real package, whose own types then apply to their code.
 */
declare module "@opennextjs/cloudflare" {
  export function initOpenNextCloudflareForDev(): void;
}
