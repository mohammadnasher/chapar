/**
 * CommonJS stub for uuid (ESM-only in v14). The entity calls `v4()` to seed an
 * id; tests only require it to be a non-empty string, so a deterministic
 * counter-based value is sufficient.
 */
let counter = 0;

export function v4(): string {
  counter += 1;
  return `00000000-0000-4000-8000-${counter.toString().padStart(12, '0')}`;
}
