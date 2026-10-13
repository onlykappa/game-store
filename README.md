> **Windows port:** This branch contains a standalone Windows adaptation in `web/`. See [Windows setup and catalog format](web/WINDOWS.md). The private upstream catalog is not included.

# Overdrive

A game store for the PS5. Builds are published on [overdriveps5/overdrive-releases](https://github.com/overdriveps5/overdrive-releases).

| Folder | What it is |
|---|---|
| [`native/`](native/README.md) | The app on the console: [PS5 React](https://github.com/overdriveps5/ps5-react) (QuickJS + Embedded React). Built and installed with `.claude/skills/overdrive-deploy`. |
| [`web/`](web/README.md) | The first version: React + Vite, served on the console by websrv (`web/ps5/`). Kept, not developed. |
| [`landing/`](landing/README.md) | An optional Next.js showcase page. Not deployed; nothing else depends on it. |

The catalog (games, download links, archive passwords, link audits) is not in this repository: it lives in a private `overdrive-catalog` repository and only enters the build. `native/data/sample` is a small fictional catalog for development and tests (`OVERDRIVE_CATALOG_DIR=native/data/sample`).

## License

GPL-3.0-or-later (see [LICENSE](LICENSE)), with the attribution term in [LICENSE-ATTRIBUTION](LICENSE-ATTRIBUTION). Overdrive derives from [Orbit Store](https://github.com/saawant12/orbit-store-ps5) (GPL-3.0). Fonts and sounds keep their own licenses: `native/assets/*-LICENSE.txt`, `native/assets/sounds/NOTICE.txt`, `landing/src/fonts/OFL.txt`.
