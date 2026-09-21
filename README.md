# RxNPV

A desktop valuation sandbox and trial-outcome simulator for retail biotech investing. macOS (Apple Silicon) only, unsigned.

**If you're Claude Code:** read `CLAUDE.md` first — it has the full project context, architecture notes, and known limitations. This file is just the quick human version.

## Running it

The app is already installed at **`/Applications/RxNPV.app`**. Launch it the same way as any other Mac app:

- Double-click it in **Applications**, or
- Press **⌘-Space** and type **RxNPV**, or
- Find it in **Launchpad**

Right-click → **Keep in Dock** if you want it permanently to hand.

It opens on a normal double-click — no Gatekeeper warning. The app isn't code-signed, but macOS only blocks *downloaded* apps (those carry a `com.apple.quarantine` flag); one built locally on this machine doesn't have it. If you ever copy the app to a **different** Mac it will be quarantined there, and that copy needs right-click → **Open** once, after which it opens normally.

Your saved cases live in the app's own local storage, not in the project folder, so rebuilding never touches them.

## Rebuilding after a code change

```bash
node build.js --install
```

That reassembles `src/`, repackages the app, and copies it into `/Applications` in one step. Quit the app first if it's running.

Other flags:

```bash
node build.js
```

Reassembles `src/` into `electron/rxnpv.html` only — no packaging. Fast, useful for checking a change compiles.

```bash
node build.js --package
```

Packages the app into `electron/dist/mac-arm64/` without installing it, which is why `--install` puts the copy you actually launch in `/Applications` instead.

Note that `electron/dist/` is **not** cleaned between builds. electron-builder overwrites its own current output but leaves unrelated files alone, so artifacts from an earlier build — including ones under a previous product name — can sit there indefinitely until deleted by hand. (This README previously claimed the folder "gets wiped on a clean rebuild"; it does not.)

**Node.js** lives at `~/.local/nodejs/current/bin` (a user-local install, no Homebrew). If `node` isn't found, add it to your PATH first:

```bash
export PATH="$HOME/.local/nodejs/current/bin:$PATH"
```

## Test

```bash
cd test && npm install && node setup.js
node math_verification.js && node final_regression_pass.js && node final_sweep.js
```

`math_verification.js` checks the engine's math against independently-derived reference values — it verifies the code computes what it claims, and deliberately never asserts that a *benchmark* value is correct, since those are hand-derived from the source document and authoritative.

See `test/README.md` for what the rest of the suite does and doesn't verify — worth reading before assuming coverage that isn't there.

## Project structure

- `src/` — the 31 source modules (see `CLAUDE.md` for why there are 31 separate files and no bundler)
- `electron/` — the desktop app shell
- `test/` — functional test suite
- `docs/` — full build history and design-decision record
