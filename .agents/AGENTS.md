# Agent Rules & Deployment Procedures

## GitHub Release & Asset Upload Rule
Whenever releasing or bumping a plugin version (`manifest.json` version):
1. Compile production build (`npm run build`).
2. Tag release (`git tag -a <version> -m "Release <version>"`).
3. Create/Publish GitHub Release matching the exact version string.
4. Attach required release assets (`main.js`, `manifest.json`, `styles.css`) to the GitHub Release.

## Dual Remote Git Push Rule
Whenever compiling a production build or pushing code updates to GitHub (`origin main`), ALWAYS push to the local Gitea server (`gitea main`) as well:

```bash
git push origin main --tags
git push gitea main --tags
```

- **Gitea Remote URL**: `http://192.168.86.44:3000/rvzenteno/O-Timebox-Daily.git`

## Deployment & Installation Paths
Always copy compiled artifacts (`main.js`, `manifest.json`, `styles.css`) to the Obsidian plugin directory:
- `~/Library/Mobile Documents/iCloud~md~obsidian/Documents/.obsidian/plugins/timebox-daily/`
