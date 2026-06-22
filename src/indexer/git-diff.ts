import { execSync } from "node:child_process";

export interface GitDiffResult {
  changedFiles: string[];
  deletedFiles: string[];
  currentCommit: string;
}

export function getRepoRoot(cwd: string): string | null {
  try {
    return execSync("git rev-parse --show-toplevel", {
      cwd,
      encoding: "utf-8",
      timeout: 5000,
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
  } catch {
    return null;
  }
}

export function getCurrentCommit(cwd: string): string | null {
  try {
    return execSync("git rev-parse HEAD", {
      cwd,
      encoding: "utf-8",
      timeout: 5000,
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
  } catch {
    return null;
  }
}

export function getChangedFilesSince(
  cwd: string,
  fromCommit: string,
): GitDiffResult | null {
  try {
    const changedRaw = execSync(
      `git diff --name-only --diff-filter=ACMRT "${fromCommit}" HEAD`,
      { cwd, encoding: "utf-8", timeout: 10000, stdio: ["ignore", "pipe", "ignore"] },
    ).trim();

    const deletedRaw = execSync(
      `git diff --name-only --diff-filter=D "${fromCommit}" HEAD`,
      { cwd, encoding: "utf-8", timeout: 10000, stdio: ["ignore", "pipe", "ignore"] },
    ).trim();

    const changedFiles = changedRaw.length > 0 ? changedRaw.split("\n") : [];
    const deletedFiles = deletedRaw.length > 0 ? deletedRaw.split("\n") : [];

    const currentCommit = getCurrentCommit(cwd);
    if (!currentCommit) return null;

    return { changedFiles, deletedFiles, currentCommit };
  } catch {
    return null;
  }
}

export function getUntrackedFiles(cwd: string): string[] {
  try {
    const raw = execSync(
      "git ls-files --others --exclude-standard",
      { cwd, encoding: "utf-8", timeout: 5000, stdio: ["ignore", "pipe", "ignore"] },
    ).trim();
    return raw.length > 0 ? raw.split("\n") : [];
  } catch {
    return [];
  }
}
