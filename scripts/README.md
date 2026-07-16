# MagicSync scripts

Cross-cutting scripts that operate at the project root. Run from the repo root
unless noted otherwise.

| Script                  | Purpose                                                                         |
| ----------------------- | ------------------------------------------------------------------------------- |
| `system.sh`             | Top-level developer command center (`./system.sh dev`, `setup`, `install`, …)   |
| `tts_assets_folder.sh`  | Downloads Supertonic-3 ONNX weights + voice styles from HuggingFace             |
| `clear.sh`              | Wipes `node_modules`, `.nuxt`, `.output` across the monorepo                    |
| `plugins.sh`            | Scaffolds a new scheduler plugin                                                |

## tts_assets_folder.sh

```bash
./scripts/tts_assets_folder.sh           # one-time setup; safe to re-run
./scripts/tts_assets_folder.sh --force   # re-download everything
```

Equivalent `pnpm` wrapper: `pnpm tts:assets`.

The Dockerfile calls this script before `pnpm site:build`, so production
images always ship the model files. See `packages/site/public/assets/onnx/README.md`
for the full picture.