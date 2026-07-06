#!/usr/bin/env node
import { execFileSync } from "node:child_process";
import { createInterface } from "node:readline/promises";
import { readFileSync } from "node:fs";
import { stdin as input, stdout as output } from "node:process";

const pkg = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8"));

const endpoint = process.env.UXRAY_UPDATE_ENDPOINT || "https://useuxray.com/v1/update";
const response = await fetch(`${endpoint}?current=${encodeURIComponent(pkg.version)}&channel=stable`);
if (!response.ok) {
  throw new Error(`Update check failed: ${response.status} ${response.statusText}`);
}

const info = await response.json();
console.log(`UXRay local version: ${info.current_version || pkg.version}`);
console.log(`UXRay latest version: ${info.latest_version}`);

if (!info.update_available) {
  console.log("UXRay is up to date.");
  process.exit(0);
}

console.log(`\nUpdate available: ${info.latest_version}`);
if (Array.isArray(info.release_notes)) {
  for (const note of info.release_notes) console.log(`- ${note}`);
}
console.log(`\nUpgrade command: ${info.commands?.upgrade || "npm run upgrade"}`);

const shouldAutoUpgrade = process.argv.includes("--auto") || process.env.UXRAY_AUTO_UPGRADE === "1";
if (shouldAutoUpgrade) {
  execFileSync("npm", ["run", "upgrade"], { stdio: "inherit" });
  process.exit(0);
}

if (!process.stdin.isTTY) {
  console.log("\nNon-interactive shell: not upgrading automatically. Run npm run check:update -- --auto or npm run upgrade when ready.");
  process.exit(0);
}

const rl = createInterface({ input, output });
const answer = (await rl.question("Auto-upgrade now? [u]pgrade / [c]ancel: ")).trim().toLowerCase();
rl.close();

if (answer === "u" || answer === "upgrade" || answer === "y" || answer === "yes") {
  execFileSync("npm", ["run", "upgrade"], { stdio: "inherit" });
} else {
  console.log("Cancelled. UXRay will keep using the current local version.");
}
