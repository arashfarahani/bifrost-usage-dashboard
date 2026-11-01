import { createRequire } from "node:module";
import { expect, it } from "vitest";

const require = createRequire(import.meta.url);
const fromNext = createRequire(require.resolve("eslint-config-next"));
const consumers = [
  ["ESLint", createRequire(require.resolve("eslint"))],
  ["React lint rules", createRequire(fromNext.resolve("eslint-plugin-react"))],
  ["Import lint rules", createRequire(fromNext.resolve("eslint-plugin-import"))],
] as const;

it.each(consumers)("keeps patched glob matching compatible with %s", (_name, fromConsumer) => {
  const matcher = fromConsumer("minimatch");
  expect(fromConsumer("minimatch/package.json").version).toBe("11.0.3");
  expect(typeof matcher).toBe("function");
  expect(matcher("src/app/page.tsx", "**/*.tsx")).toBe(true);
  expect(matcher("src/app/page.ts", "**/*.tsx")).toBe(false);
  expect(matcher("src/.hidden.ts", "**/*.ts", { dot: true })).toBe(true);
  expect(matcher("src/Card.tsx", "card.tsx", { matchBase: true, nocase: true })).toBe(true);
  expect(matcher.minimatch("src/app/page.tsx", "**/*.tsx")).toBe(true);
  expect(new matcher.Minimatch("**/*.tsx").match("src/app/page.tsx")).toBe(true);
});
