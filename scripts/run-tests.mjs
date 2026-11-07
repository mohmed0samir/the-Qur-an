// Dependency-free test runner: bundles tests/*.test.ts with esbuild (already a
// devDependency) and runs them with Node's built-in test runner.
import { build } from "esbuild";
import { spawnSync } from "node:child_process";
import { mkdtempSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const testsDir = join(root, "tests");
const entries = readdirSync(testsDir)
  .filter((f) => f.endsWith(".test.ts"))
  .map((f) => join(testsDir, f));

const out = mkdtempSync(join(tmpdir(), "quran-tests-"));
try {
  await build({
    entryPoints: entries,
    outdir: out,
    bundle: true,
    platform: "node",
    format: "esm",
    target: "node20",
    outExtension: { ".js": ".mjs" },
    logLevel: "warning"
  });
  const files = readdirSync(out).filter((f) => f.endsWith(".mjs")).map((f) => join(out, f));
  const res = spawnSync(process.execPath, ["--test", ...files], { stdio: "inherit" });
  process.exitCode = res.status ?? 1;
} finally {
  rmSync(out, { recursive: true, force: true });
}
