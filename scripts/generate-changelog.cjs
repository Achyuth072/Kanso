#!/usr/bin/env node
const { execSync } = require("child_process");
const fs = require("fs");
const path = require("path");

const version = process.argv[2];
const since = process.argv[3];
const until = process.argv[4] || "HEAD";
const date = process.argv[5] || new Date().toISOString().split("T")[0];

if (!version || !since) {
  console.error(
    "Usage: generate-changelog.cjs <version> <since> [until] [date]",
  );
  console.error("  <version>  Version string (e.g. 1.19.2-preview.11)");
  console.error(
    "  <since>    Git ref to start log from (e.g. <prev_release_hash>)",
  );
  console.error("  [until]    Optional end ref (defaults to HEAD)");
  console.error("  [date]     Optional date (defaults to today)");
  process.exit(1);
}

const changelogFile = path.join(process.cwd(), "public", "changelog.json");
fs.mkdirSync(path.dirname(changelogFile), { recursive: true });

function exec(cmd) {
  return execSync(cmd, {
    encoding: "utf-8",
    maxBuffer: 10 * 1024 * 1024,
  }).trim();
}

const hashes = exec(
  `git log "${since}..${until}" --format="%H" --no-merges` +
    ` -- . ":(exclude).planning" ":(exclude).agent" ":(exclude).gemini" ":(exclude).husky" ":(exclude).vercelignore"`,
)
  .split("\n")
  .filter(Boolean);

const commits = [];

for (const hash of hashes) {
  const subject = exec(`git log -1 --format="%s" "${hash}"`);

  if (/^chore: .*release/.test(subject)) continue;
  if (/^merge: sync release/.test(subject)) continue;

  const body = exec(`git log -1 --format="%b" "${hash}"`);

  commits.push({
    hash: hash.substring(0, 7),
    heading: subject,
    body: body || "",
  });
}

let entries = [];
if (fs.existsSync(changelogFile)) {
  try {
    entries = JSON.parse(fs.readFileSync(changelogFile, "utf-8"));
  } catch {
    console.warn(
      "Warning: could not parse existing changelog.json, starting fresh",
    );
  }
}

entries.unshift({ version, date, commits });

fs.writeFileSync(changelogFile, JSON.stringify(entries, null, 2) + "\n");
console.log(
  `✓ Added changelog entry for v${version} (${commits.length} commits)`,
);
