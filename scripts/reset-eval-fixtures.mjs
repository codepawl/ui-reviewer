import { cp } from "node:fs/promises";

const source = process.env.EVAL_FIXTURE_SEED_DIR ?? "examples/eval-fixtures-seed";
const target = process.env.EVAL_FIXTURE_DIR ?? "examples/eval-fixtures";

await cp(source, target, { recursive: true, force: true });
console.log(JSON.stringify({ source, target, status: "reset" }, null, 2));
