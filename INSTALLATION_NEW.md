# TimeBox Daily - Installation Guide

## Quick Start

### Step 1: Locate Your Obsidian Plugins Folder

1. Open Obsidian
2. Open Settings (gear icon in bottom left)
3. Go to "Files & Links"
4. Note your vault location, or click "Reveal in file explorer"
5. Navigate to: `YourVault/.obsidian/plugins/`

If the `plugins` folder doesn't exist, create it.

### Step 2: Install the Plugin

#### Option A: From Source (Full Build)

1. Download/extract the plugin files to: `.obsidian/plugins/timebox-daily/`
2. Open terminal/command prompt in that folder
3. Run:
   ```bash
   npm install
   npm run build
   ```
4. Restart Obsidian
5. Go to Settings → Community Plugins
6. Find "TimeBox Daily" and enable it

#### Option B: Pre-built Files (Quick Install)

1. Create folder: `.obsidian/plugins/timebox-daily/`
2. Copy these files into it:
   - `main.js` (must be built first using Option A)
   - `manifest.json`
   - `styles.css`
3. Restart Obsidian
4. Enable in Settings → Community Plugins

### Step 3: Configure the Plugin

1. Open Settings → Community Plugins
2. Find "TimeBox Daily" and click the gear icon
3. Configure:
   - **TimeBox Folder**: Default is "TimeBox" (you can change this)
   - **Auto-open on Startup**: Toggle ON for automatic opening
   - **Carry Forward Tasks**: Toggle ON to move incomplete tasks
   - **Carry Forward Brain Dumps**: Toggle ON to move brain dump items
   - **TimeBox Template**: Customize your daily template

### Step 4: First Use

1. Close and reopen Obsidian (if auto-open is enabled)
2. OR click the calendar-clock icon in the left ribbon
3. OR press `Ctrl/Cmd + P` and type "Open today's TimeBox"

Your first TimeBox will be created!

## Building from Source

### Prerequisites

- Node.js (v16 or higher)
- npm (comes with Node.js)

### Build Steps

```bash
# Navigate to the plugin folder
cd /path/to/vault/.obsidian/plugins/timebox-daily/

# Install dependencies
npm install

# Build for development (with file watching)
npm run dev

# OR build for production
npm run build
```

The build process creates `main.js` which Obsidian needs to run the plugin.

## Verification

After installation, verify the plugin is working:

1. Check Settings → Community Plugins shows "TimeBox Daily"
2. Look for the calendar-clock icon in the left ribbon
3. Test the command palette: `Ctrl/Cmd + P` → "Open today's TimeBox"
4. Check that a `TimeBox` folder was created in your vault

## Troubleshooting

### Plugin Won't Enable

- **Issue**: Plugin appears but won't enable
- **Solution**: Make sure you've built the plugin (`npm run build`) and `main.js` exists

### Missing Dependencies

- **Issue**: Build fails with missing dependencies
- **Solution**: Delete `node_modules` folder and run `npm install` again

### Plugin Not Appearing

- **Issue**: Plugin doesn't show up in Community Plugins list
- **Solution**: 
  - Verify folder name is exactly `timebox-daily`
  - Check `manifest.json` exists and is valid JSON
  - Restart Obsidian

### Auto-Open Not Working

- **Issue**: TimeBox doesn't open on startup
- **Solution**:
  - Check "Auto-open on startup" is enabled in settings
  - Completely quit and restart Obsidian (don't just reload)

### Items Not Carrying Forward

- **Issue**: Yesterday's tasks don't appear today
- **Solution**:
  - Verify tasks use `- [ ]` format with space between brackets
  - Check carry forward options are enabled in settings
  - Ensure yesterday's file exists in the TimeBox folder

## File Structure After Installation

```
YourVault/
├── .obsidian/
│   └── plugins/
│       └── timebox-daily/
│           ├── main.js          (built file - required)
│           ├── main.ts          (source code)
│           ├── manifest.json    (required)
│           ├── styles.css       (required)
│           ├── package.json
│           ├── tsconfig.json
│           ├── esbuild.config.mjs
│           ├── version-bump.mjs
│           ├── versions.json
│           └── README.md
└── TimeBox/                     (created automatically)
    └── YYYY-MM-DD.md           (daily files)
```

## Updating the Plugin

1. Replace the plugin files in `.obsidian/plugins/timebox-daily/`
2. Run `npm install && npm run build` if updating from source
3. Restart Obsidian

## Uninstallation

1. Go to Settings → Community Plugins
2. Disable "TimeBox Daily"
3. Delete the `.obsidian/plugins/timebox-daily/` folder
4. (Optional) Delete your `TimeBox` folder if you no longer need the files

## Getting Help

If you encounter issues:

1. Check this installation guide
2. Review the main README.md for usage help
3. Verify all required files are present
4. Check the Obsidian console (Ctrl/Cmd + Shift + I) for errors
5. Open an issue on GitHub with:
   - Obsidian version
   - Plugin version
   - Error messages
   - Steps to reproduce

---

**Ready to start TimeBoxing!** 📦⏰
