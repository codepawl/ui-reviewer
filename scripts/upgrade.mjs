#!/usr/bin/env node
import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const run = (command, args, options = {}) => {
  console.log(`$ ${[command, ...args].join(" ")}`);
  execFileSync(command, args, { cwd: root, stdio: "inherit", ...options });
};
const capture = (command, args) => execFileSync(command, args, { cwd: root, encoding: "utf8" }).trim();

if (!existsSync(resolve(root, ".git"))) {
  console.error("UXRay upgrade expects a git clone. Reinstall from https://github.com/codepawl/uxray if this folder is not a git repo.");
  process.exit(1);
}

const dirty = capture("git", ["status", "--porcelain"]);
if (dirty && process.env.UXRAY_UPGRADE_ALLOW_DIRTY !== "1") {
  console.error("Refusing to auto-upgrade with local changes. Commit/stash first, or set UXRAY_UPGRADE_ALLOW_DIRTY=1 if you know what you are doing.");
  console.error(dirty);
  process.exit(1);
}

const branch = capture("git", ["branch", "--show-current"]) || "master";
run("git", ["fetch", "origin", branch]);
run("git", ["pull", "--ff-only", "origin", branch]);
run("npm", ["install"]);
run("npm", ["run", "build"]);
console.log("UXRay upgrade complete.");
