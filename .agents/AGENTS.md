# Agent Rules & Deployment Procedures

## GitHub Release & Cover Documentation Rule
Whenever releasing or bumping a plugin version (`manifest.json` version):
1. **Update Release Documentation**: Update `README.md` (cover description & feature highlights) and `CHANGELOG.md` with all new features and fixes.
2. **Compile Production Build**: Run `npm run build`.
3. **Copy to Obsidian Vault**: Copy compiled artifacts (`main.js`, `manifest.json`, `styles.css`) to `~/Library/Mobile Documents/iCloud~md~obsidian/Documents/.obsidian/plugins/timebox-daily/`.
4. **Tag Release**: Tag git release with exact version string (`git tag -a <version> -m "Release <version>"`).
5. **Publish GitHub Release**: Create & publish GitHub Release matching the exact version string with a detailed release body description.
6. **Attach Release Assets**: Attach required release assets (`main.js`, `manifest.json`, `styles.css`) to the GitHub Release.
7. **Dual Remote Push**: Push to both GitHub (`origin main --tags`) and local Gitea server (`gitea main --tags`).

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
