# Environment observations and approved solutions

This document records environment-specific observations for the Windows/DSH host used by
this project. It is not a command manual; operational commands live in
[harness.md](harness.md). It does not authorize environment changes: those require a
separate human-approved environment maintenance task under [AGENTS.md](../../AGENTS.md).

SDR-002 is documentation-only. It did not run environment diagnostics, install software,
change permissions or modify sandbox settings. The ENV-001 incident below is recorded from
the accepted ENV-001 report and its proof run.

## 1. Standard execution mode

- The standard DSH mode is `workspace-write`.
- Do not escalate execution privileges or switch to a less restrictive sandbox mode
  without explicit human authorization, even for read-only commands.
- Commands that need dependency installation, database changes, application startup,
  paid API calls or a broader sandbox environment require the task's explicit
  authorization. They are not implied by ordinary workspace access.
- Do not modify ACLs, integrity labels, Windows permissions or sandbox configuration to
  make a command pass. Report the blocker instead.

## 2. ENV-001 — PowerShell execution

### Confirmed observations

- DSH's PowerShell resolver selected the Microsoft Store app execution alias under
  `%LOCALAPPDATA%\Microsoft\WindowsApps\pwsh.exe`. No PowerShell 7 MSI installation was
  present at `C:\Program Files\PowerShell\7\pwsh.exe` at that time.
- Under the standard `workspace-write` sandbox, the Store alias failed before the command
  ran: the Windows ACL runner reported `CreateProcessAsUserW failed (Win32 5)` and DSH
  classified the runner as failed (exit 127). The alias also failed in an attempted
  `danger-full-access` probe with `spawn EPERM`.
- PowerShell 7 was installed to `C:\Program Files\PowerShell\7\pwsh.exe`. The observed
  installed version was **7.6.6**.
- DSH's resolver then selected the Program Files executable without a custom `pwshPath`
  setting. The DSH profile configuration did not need a PowerShell override.
- The ENV-001 proof successfully ran PowerShell and Git commands under standard
  `workspace-write`; the resolved executable path and version were confirmed by that run.
- The Microsoft Store PowerShell package was not uninstalled. No sandbox restriction was
  weakened, no ACL was relaxed and no broader sandbox mode was used for the proof.

### Inferred or not established

- The Store executable lives in a managed package tree whose access under the low-integrity
  restricted token is consistent with DSH's documented AppContainer package-SID limitation.
  That is an inference from the observed failure and DSH documentation, not a directly
  inspected ACL.
- The exact mechanism of the earlier `danger-full-access` `spawn EPERM` failure was not
  fully established. It did not block the accepted resolution, which uses Program Files.
- The Store alias may still fail if `C:\Program Files\PowerShell\7\pwsh.exe` is removed.
  The resolver would then fall back to `PATH` and may select the Store alias again.

### Operational guidance

- Keep the Program Files PowerShell installation as the resolved `pwsh` for DSH. Do not
  point `pwshPath` at the Store alias.
- Do not use a Store/MSIX PowerShell installation as the DSH shell where the standard
  `workspace-write` sandbox must launch it.
- If the resolver or shell fails again, record the exact command, error and resolved path
  and report the blocker. Do not relax the sandbox to work around it.
- Any change to the installation, PATH, permissions or DSH runtime configuration requires
  a separate human-approved environment maintenance task.

## 3. Historical tooling observations

These were observed on this Windows/DSH host on earlier dates. They are environment-specific
observations, not universal facts, and may change with DSH, Node.js, Next.js or Windows
updates. Re-check before relying on them.

- **npm PowerShell shims.** The `npm.ps1`/`npx.ps1` shims were observed to fail with a
  named-pipe access error; `npm.cmd` and `npx.cmd` worked. Use the `.cmd` forms in
  PowerShell when this recurs.
- **Piping native output into PowerShell cmdlets.** Commands such as
  `git status | Select-Object …` were observed to fail on the same named-pipe boundary.
  Let the tool capture the output or redirect to a file instead.
- **Next.js process spawning.** `next build` and `next dev`/`next start` were observed to
  fail under `workspace-write` with `spawn EPERM` when they forked worker or server
  processes. That is a historical sandbox observation, not evidence that a broader mode is
  authorized. A build or dev server needs an explicitly authorized task and the appropriate
  environment.
- **npm cache location.** npm's default cache is outside the workspace and was observed to
  be blocked by the file sandbox. A workspace-safe cache can be selected for an authorized
  install; do not change global npm configuration as an undocumented workaround.
- **Vitest pool.** The default `forks` pool was observed to fail under the sandbox;
  `apps/web/vitest.config.ts` pins the `threads` pool.
- **Next dev host name.** Next 16 blocks dev resources for a host name other than the one it
  advertises; use `localhost`, not `127.0.0.1`, for a Next dev server under test.
- **E2E build directory.** `apps/web/next.config.ts` reads `NEXT_DIST_DIR`; Playwright uses
  an isolated output directory (`.next-e2e`) so it can run next to a normal dev server.
- **E2E target.** The E2E suite targets `apps/web/e2e/mock-api.mjs`, never the paid research
  API. Pointing E2E at the real API would start paid calls.
- **Generated Next types.** `next-env.d.ts` is generated and git-ignored. Do not edit or
  commit it.

## 4. Sandbox boundary

The Windows sandbox is a write-restriction mechanism, not a general security boundary
against reads or network use. Its documented limits (for example, Low-integrity package-SID
access and piped-stdio grandchild spawning) belong to DSH, not to this project. Do not
compensate for them by changing project code, ACLs or sandbox configuration.

## 5. Responsibility

Environment observations belong in this document. Commands and verification procedure
belong in [harness.md](harness.md). Agent authority and the environment-change exception
belong in [AGENTS.md](../../AGENTS.md). If an environment fact is uncertain, label it as an
observation or inference rather than a confirmed universal rule.
