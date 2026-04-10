import { promisify } from "util";
import { execFile } from "child_process";
import { access } from "fs/promises";

import { TARGET_SITE_PATH } from "@/lib/config";
import {
  markPublishedApprovalStates,
  readContentDraftReport,
  readDeployActionState,
  readPuppyListingReport,
  writeDeployActionState
} from "@/lib/storage";
import type {
  DeployActionState,
  DeployChangedFile,
  DeployStatusReport
} from "@/types/health";

const execFileAsync = promisify(execFile);
const localReleaseUnavailableMessage =
  "Local SEO/content release tooling is unavailable in this hosted environment. Puppy listings remain available through the Supabase-backed dashboard.";

function emptyActionState(): DeployActionState {
  return {
    status: "idle",
    message: "",
    updatedAt: ""
  };
}

async function runGit(args: string[]) {
  return execFileAsync("git", ["-C", TARGET_SITE_PATH, ...args], {
    windowsHide: true
  });
}

async function isLocalReleaseRepoAvailable(): Promise<boolean> {
  try {
    await access(TARGET_SITE_PATH);
    await runGit(["rev-parse", "--is-inside-work-tree"]);
    return true;
  } catch (error) {
    if (process.env.KENNEL_HEALTH_DEBUG === "true") {
      console.log("[DeployStatusLocalUnavailable]", {
        repoPath: TARGET_SITE_PATH,
        reason: error instanceof Error ? error.message : "Unknown local repo access error."
      });
    }

    return false;
  }
}

function summarizeStatusCode(statusCode: string): string {
  const trimmed = statusCode.trim();

  if (trimmed === "M" || statusCode.includes("M")) {
    return "Modified";
  }

  if (trimmed === "A" || statusCode.includes("A")) {
    return "Added";
  }

  if (trimmed === "D" || statusCode.includes("D")) {
    return "Deleted";
  }

  if (trimmed === "R" || statusCode.includes("R")) {
    return "Renamed";
  }

  if (trimmed === "??") {
    return "Untracked";
  }

  return "Changed";
}

function parseChangedFiles(statusOutput: string): {
  gitStatusSummary: string;
  isAheadOfRemote: boolean;
  changedFiles: DeployChangedFile[];
} {
  const lines = statusOutput
    .split(/\r?\n/)
    .map((line) => line.trimEnd())
    .filter(Boolean);

  const header = lines[0] ?? "## main";
  const changedFiles = lines.slice(1).map((line) => {
    const statusCode = line.slice(0, 2);
    const filePath = line.slice(3).trim();

    return {
      path: filePath,
      statusCode,
      summary: summarizeStatusCode(statusCode)
    };
  });

  return {
    gitStatusSummary: header.replace(/^##\s*/, ""),
    isAheadOfRemote: /\[ahead\b/.test(header),
    changedFiles
  };
}

function buildSuggestedCommitMessage(changedFiles: DeployChangedFile[]): string {
  if (changedFiles.length === 0) {
    return "";
  }

  const changedPaths = changedFiles.map((file) => file.path.toLowerCase());
  const touchesSeo = changedPaths.some(
    (filePath) => filePath.endsWith("src/app/layout.tsx")
  );
  const touchesHomepage = changedPaths.some(
    (filePath) =>
      filePath.endsWith("src/app/page.tsx") ||
      filePath.endsWith("src/components/homepageclient.tsx")
  );

  if (touchesSeo && touchesHomepage) {
    return "Apply approved homepage SEO and hero updates";
  }

  if (touchesSeo) {
    return "Update homepage SEO metadata";
  }

  if (touchesHomepage) {
    return "Update homepage messaging and CTA";
  }

  if (changedFiles.length === 1) {
    return `Update ${changedFiles[0].path}`;
  }

  return "Apply approved website updates";
}

async function readRepoStatus() {
  const [{ stdout: branchStdout }, { stdout: statusStdout }] = await Promise.all([
    runGit(["branch", "--show-current"]),
    runGit(["status", "--short", "--branch"])
  ]);

  const parsedStatus = parseChangedFiles(statusStdout);

  return {
    currentBranch: branchStdout.trim() || "unknown",
    ...parsedStatus
  };
}

export async function buildDeployStatusReport(): Promise<DeployStatusReport> {
  if (!(await isLocalReleaseRepoAvailable())) {
    return {
      generatedAt: new Date().toISOString(),
      repoPath: TARGET_SITE_PATH,
      currentBranch: "unavailable",
      gitStatusSummary: localReleaseUnavailableMessage,
      isClean: true,
      isAheadOfRemote: false,
      changedFiles: [],
      suggestedCommitMessage: "",
      commitStatus: emptyActionState(),
      pushStatus: emptyActionState(),
      publishStatus: {
        status: "idle",
        message: localReleaseUnavailableMessage,
        updatedAt: new Date().toISOString()
      },
      readyForVerification: false,
      lastPublishResult: localReleaseUnavailableMessage
    };
  }

  const [repoStatus, actionState] = await Promise.all([
    readRepoStatus(),
    readDeployActionState()
  ]);

  const report = {
    generatedAt: new Date().toISOString(),
    repoPath: TARGET_SITE_PATH,
    currentBranch: repoStatus.currentBranch,
    gitStatusSummary: repoStatus.gitStatusSummary,
    isClean: repoStatus.changedFiles.length === 0,
    isAheadOfRemote: repoStatus.isAheadOfRemote,
    changedFiles: repoStatus.changedFiles,
    suggestedCommitMessage: buildSuggestedCommitMessage(repoStatus.changedFiles),
    commitStatus: actionState.commitStatus,
    pushStatus: actionState.pushStatus,
    publishStatus: actionState.publishStatus,
    readyForVerification: actionState.publishStatus.status === "success",
    lastPublishResult:
      actionState.publishStatus.message ||
      "No publish action has been run yet."
  };

  if (process.env.KENNEL_HEALTH_DEBUG === "true") {
    console.log("[DeployStatus]", {
      changedFileCount: report.changedFiles.length,
      changedFiles: report.changedFiles.map((file) => file.path),
      isClean: report.isClean
    });
  }

  return report;
}

export async function commitDeployChanges(message?: string): Promise<DeployStatusReport> {
  if (!(await isLocalReleaseRepoAvailable())) {
    throw new Error(localReleaseUnavailableMessage);
  }

  const status = await buildDeployStatusReport();

  if (status.changedFiles.length === 0) {
    throw new Error("There are no local changes to commit.");
  }

  const commitMessage = message?.trim() || status.suggestedCommitMessage;

  if (!commitMessage) {
    throw new Error("A commit message is required when changes are present.");
  }

  try {
    // Keep the deploy flow explicit: stage current changes, commit once, then return fresh status.
    await runGit(["add", "-A"]);
    const { stdout } = await runGit(["commit", "-m", commitMessage]);

    const currentState = await readDeployActionState();
    await writeDeployActionState({
      commitStatus: {
        status: "success",
        message: stdout.trim() || `Committed changes with: ${commitMessage}`,
        updatedAt: new Date().toISOString()
      },
      pushStatus: currentState.pushStatus.status === "success"
        ? emptyActionState()
        : currentState.pushStatus,
      publishStatus: emptyActionState()
    });
  } catch (error) {
    const messageText =
      error instanceof Error ? error.message : "Unknown git commit error.";

    const currentState = await readDeployActionState();
    await writeDeployActionState({
      commitStatus: {
        status: "failed",
        message: messageText,
        updatedAt: new Date().toISOString()
      },
      pushStatus: currentState.pushStatus,
      publishStatus: emptyActionState()
    });

    throw error;
  }

  return buildDeployStatusReport();
}

export async function pushDeployChanges(): Promise<DeployStatusReport> {
  if (!(await isLocalReleaseRepoAvailable())) {
    throw new Error(localReleaseUnavailableMessage);
  }

  const status = await buildDeployStatusReport();

  if (!status.isAheadOfRemote) {
    throw new Error("There is nothing local to push to origin/main.");
  }

  try {
    const { stdout, stderr } = await runGit(["push", "origin", "main"]);

    const currentState = await readDeployActionState();
    await writeDeployActionState({
      commitStatus: currentState.commitStatus,
      pushStatus: {
        status: "success",
        message: (stdout || stderr).trim() || "Push completed successfully.",
        updatedAt: new Date().toISOString()
      },
      publishStatus: currentState.publishStatus
    });
  } catch (error) {
    const messageText =
      error instanceof Error ? error.message : "Unknown git push error.";

    const currentState = await readDeployActionState();
    await writeDeployActionState({
      commitStatus: currentState.commitStatus,
      pushStatus: {
        status: "failed",
        message: messageText,
        updatedAt: new Date().toISOString()
      },
      publishStatus: currentState.publishStatus
    });

    throw error;
  }

  return buildDeployStatusReport();
}

export async function publishToLiveSite(): Promise<DeployStatusReport> {
  if (!(await isLocalReleaseRepoAvailable())) {
    throw new Error(localReleaseUnavailableMessage);
  }

  const status = await buildDeployStatusReport();

  if (status.changedFiles.length === 0) {
    const currentState = await readDeployActionState();
    await writeDeployActionState({
      ...currentState,
      publishStatus: {
        status: "failed",
        message: "No local website changes were found, so nothing was published.",
        updatedAt: new Date().toISOString()
      }
    });

    throw new Error("No local website changes were found, so nothing was published.");
  }

  try {
    const committedReport = await commitDeployChanges(status.suggestedCommitMessage);
    const pushedReport = await pushDeployChanges();
    const currentState = await readDeployActionState();
    const changedFileCount = status.changedFiles.length;

    await writeDeployActionState({
      commitStatus: currentState.commitStatus,
      pushStatus: currentState.pushStatus,
      publishStatus: {
        status: "success",
        message:
          `Published ${changedFileCount} changed file${changedFileCount === 1 ? "" : "s"} to origin/main. Ready for verification.`,
        updatedAt: new Date().toISOString()
      }
    });
    // Promote successfully merged approval items into published history only
    // after the repo push succeeds.
    await markPublishedApprovalStates();
    // Persist the content lifecycle transition into the original content-drafts
    // source file so deployed drafts stop appearing as active suggestions.
    await readContentDraftReport();
    // Persist puppy listing placement lifecycle transitions only after the
    // publish step succeeds, so placement alone never consumes listings.
    await readPuppyListingReport();

    void committedReport;
    void pushedReport;

    return buildDeployStatusReport();
  } catch (error) {
    const currentState = await readDeployActionState();
    const messageText =
      error instanceof Error ? error.message : "Unknown publish error.";

    await writeDeployActionState({
      commitStatus: currentState.commitStatus,
      pushStatus: currentState.pushStatus,
      publishStatus: {
        status: "failed",
        message: messageText,
        updatedAt: new Date().toISOString()
      }
    });

    throw error;
  }
}
