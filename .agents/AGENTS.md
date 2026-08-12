# Agent Rules & Deployment Procedures

## Dual Remote Git Push Rule
Whenever compiling a production build or pushing code updates to GitHub (`origin main`), ALWAYS push to the local Gitea server (`gitea main`) as well:

```bash
git push origin main
git push gitea main
```

- **Gitea Remote URL**: `http://192.168.86.44:3000/rvzenteno/O-Timebox-Daily.git`

## Deployment & Installation Paths
Always copy compiled artifacts (`main.js`, `manifest.json`, `styles.css`) to the Obsidian plugin directory:
- `~/Library/Mobile Documents/iCloud~md~obsidian/Documents/.obsidian/plugins/timebox-daily/`
