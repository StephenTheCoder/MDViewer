# Release storage

`master` holds ongoing source work. `archive/localmd-1.0.2` preserves commit `9813959` (the released source, README and recorded validation evidence). Keep that branch as a snapshot; create another archive branch for a future release rather than editing this one. Executables are not stored in either branch.

The [published LocalMD 1.0.2 release](https://github.com/StephenTheCoder/MDViewer/releases/tag/v1.0.2) provides the portable executable, installer and SHA-256 checksum file as release assets. Tag `v1.0.2` points to the preserved source snapshot `9813959`. GitHub's asset digests were verified against the local files before publication; the source archive contains no executables.

Local build and release files live under the Git-ignored `.artifacts` directory:

| Location | Contents |
| --- | --- |
| `.artifacts/releases/1.0.2/` | Current portable/installer executables, blockmap, checksums, builder diagnostics and the complete `win-unpacked` runtime |
| `.artifacts/archive/1.0.1/` | Retained 1.0.1 executables, blockmap and checksums |
| `.artifacts/archive/1.0.0/` | Retained 1.0.0 executables and blockmap |

The directory has the Windows Hidden attribute on this checkout. Paste its full path into Explorer or enable **Hidden items** to browse it. Hidden attributes are local filesystem metadata and are not preserved by Git. Fresh packaging creates the ignored directory, but does not change Explorer settings or system defaults.

The relocation preserved the files byte for byte. Existing acceptance results and JSON are historical records: their `release/LocalMD-1.0.2-*.exe` and `release/win-unpacked/` paths now map to `.artifacts/releases/1.0.2/`. Their hashes still identify the same binaries. This organization change is not a new runtime build or a repeat of the full acceptance audit. New audit runs record their actual current paths.

`package.json`'s `build.directories.output` is the build destination. `scripts/release-paths.mjs` and `tests/desktop/paths.ts` read that configuration so packaging checks, portable launch/audit scripts and desktop tests stay aligned. When bumping a release, update the package version, artifact names and output version directory together. Archive the previous output without moving individual files out of `win-unpacked`.

Launch from the project root:

```powershell
$localmdDocument = (Resolve-Path -LiteralPath '.\samples\welcome.md').Path
& '.\.artifacts\releases\1.0.2\LocalMD-1.0.2-portable-x64.exe' $localmdDocument
```

Rebuild with `npm run package:win`. Run `node scripts/check-package.mjs --check-only` to compare the retained unpacked runtime with `out/` without overwriting historical provenance. `node scripts/portable-smoke.mjs` launches the current portable executable with a synthetic document and isolated profile.

Relocation checks on 8 October 2026 passed: all 86 moved files retained their size and SHA-256, type checking and script syntax checks passed, the archive comparison matched 70 compiled runtime files, and all 18 desktop tests were discovered using the updated paths. The actual relocated portable app opened a synthetic Markdown document and rendered Mermaid. The relocated unpacked app passed `tests/desktop/app.spec.ts` (9.4 seconds), covering native services for opening, tabs, reload, links, tools, exports, PDF and restart with controlled dialog destinations and an isolated profile. Interactive Windows dialogs and installation were not retested.
