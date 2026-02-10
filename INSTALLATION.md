# TimeBox Manager - Installation Guide

This guide will walk you through installing and setting up the TimeBox Manager plugin for Obsidian.

## 📋 Prerequisites

- Obsidian version 0.15.0 or higher
- Basic familiarity with Obsidian plugins

## 🔧 Installation Methods

### Method 1: Manual Installation (Recommended for Development)

This method is best if you want to build the plugin yourself or make custom modifications.

#### Step 1: Locate Your Vault's Plugin Folder

1. Open your Obsidian vault
2. Navigate to: `YourVault/.obsidian/plugins/`
   - On Windows: `C:\Users\YourName\Documents\MyVault\.obsidian\plugins\`
   - On Mac: `/Users/YourName/Documents/MyVault/.obsidian/plugins/`
   - On Linux: `/home/yourname/Documents/MyVault/.obsidian/plugins/`

**Note**: The `.obsidian` folder is hidden by default. You may need to enable "Show hidden files" in your file explorer.

#### Step 2: Create Plugin Directory

1. Inside the `plugins` folder, create a new folder called `timebox-manager`
2. Your path should now be: `.obsidian/plugins/timebox-manager/`

#### Step 3: Copy Plugin Files

Copy these files into the `timebox-manager` folder:
- `main.ts`
- `manifest.json`
- `package.json`
- `tsconfig.json`
- `esbuild.config.mjs`
- `version-bump.mjs`
- `versions.json`

#### Step 4: Install Dependencies

Open a terminal in the `timebox-manager` folder and run:

```bash
npm install
```

If you don't have Node.js installed:
- Download from: https://nodejs.org/
- Install LTS version
- Restart your terminal

#### Step 5: Build the Plugin

```bash
npm run build
```

This will create `main.js` which Obsidian needs to run the plugin.

#### Step 6: Enable the Plugin

1. Open Obsidian
2. Go to Settings (gear icon)
3. Navigate to: Community plugins
4. Click "Reload plugins" button
5. Find "TimeBox Manager" in the list
6. Toggle it ON

### Method 2: Quick Manual Installation (For Pre-built Files)

If you have the pre-built files (`main.js`, `manifest.json`):

1. Create folder: `.obsidian/plugins/timebox-manager/`
2. Copy `main.js` and `manifest.json` into this folder
3. Reload Obsidian
4. Enable the plugin in Settings → Community plugins

## ✅ Verification

After installation, verify the plugin is working:

1. **Check for Ribbon Icon**: Look for a calendar-check icon in the left sidebar
2. **Test Command**: Press `Ctrl/Cmd + P` and search for "TimeBox"
3. **Auto-Open**: Restart Obsidian - today's TimeBox should open automatically

## ⚙️ Initial Configuration

### Basic Setup

1. Open Settings → TimeBox Manager
2. Verify settings:
   - **TimeBox Folder**: Default is `TimeBox` (you can change this)
   - **Auto-open on Startup**: Should be enabled
   - **Rollover Incomplete Tasks**: Should be enabled

### First Use

1. Click the calendar icon in the ribbon OR
2. Press `Ctrl/Cmd + P` → "Open Today's TimeBox"
3. Your first TimeBox note will be created!

### Customizing Your Template

1. Go to Settings → TimeBox Manager
2. Scroll to "Template Customization"
3. Edit the template to match your workflow
4. Use `{{date}}` where you want the date to appear

**Example Customizations**:
```markdown
# TimeBox - {{date}}

## 🎯 Today's Big Win
What's the ONE thing that will make today successful?

## ⏰ Time Blocks
### 🌅 Early Morning (5:00 AM - 8:00 AM)
- [ ] Morning routine
- [ ] Exercise

### 💼 Work Block 1 (9:00 AM - 12:00 PM)
- [ ] 

### 🍽️ Midday Break (12:00 PM - 1:00 PM)
- [ ] Lunch and walk

### 💼 Work Block 2 (1:00 PM - 5:00 PM)
- [ ] 

### 🌙 Evening (6:00 PM - 9:00 PM)
- [ ] Personal projects
- [ ] Family time

## 📋 Tasks
### High Priority
- [ ] 

### Medium Priority
- [ ] 

### Low Priority
- [ ] 

## 🧠 Brain Dump

## 💪 Health & Wellness
- Water intake: 
- Exercise: 
- Sleep: 

## 📚 Learning
- 

## 📝 Notes & Reflections

## ✅ Completed Today
```

## 🐛 Troubleshooting

### Plugin Not Showing Up

1. **Check Plugin Folder Structure**:
   ```
   .obsidian/
   └── plugins/
       └── timebox-manager/
           ├── main.js
           ├── manifest.json
           └── (other files)
   ```

2. **Verify Files**: Ensure `main.js` and `manifest.json` exist
3. **Check Obsidian Version**: Must be 0.15.0 or higher
4. **Reload Plugins**: Settings → Community plugins → Reload
5. **Enable Community Plugins**: Settings → Community plugins → Turn on

### Build Errors

If `npm run build` fails:

```bash
# Clear node_modules and reinstall
rm -rf node_modules package-lock.json
npm install
npm run build
```

### Plugin Crashes or Doesn't Load

1. **Check Console**:
   - Press `Ctrl/Cmd + Shift + I` to open Developer Tools
   - Check Console tab for error messages

2. **Disable Other Plugins**: Test if there's a conflict
   - Disable all other plugins
   - Enable TimeBox Manager
   - If it works, re-enable plugins one by one

3. **Check File Permissions**: Ensure Obsidian can read/write to the plugin folder

### TimeBox Not Auto-Opening

1. Settings → TimeBox Manager
2. Verify "Auto-open on Startup" is enabled
3. Restart Obsidian completely (close all windows)
4. Check if TimeBox folder was created in your vault

### Tasks Not Rolling Over

1. Verify setting: "Rollover Incomplete Tasks" is enabled
2. Check that yesterday's file exists in the TimeBox folder
3. Ensure incomplete tasks are formatted as: `- [ ] Task name`
4. Tasks in "## ✅ Completed Today" section won't rollover (this is intentional)

## 🔄 Updating the Plugin

### From Source

```bash
cd .obsidian/plugins/timebox-manager
git pull
npm install
npm run build
```

Then reload Obsidian.

### Manual Update

1. Download new release files
2. Replace `main.js` and `manifest.json`
3. Reload plugins in Obsidian

## 📱 Mobile Installation

For iOS/Android:

1. Use a file manager app to access your vault's `.obsidian/plugins/` folder
2. Create `timebox-manager` folder
3. Copy `main.js` and `manifest.json`
4. Open Obsidian mobile app
5. Enable the plugin in Settings

**Note**: Building from source on mobile is not supported. Use pre-built files.

## 🗑️ Uninstalling

1. Settings → Community plugins
2. Find "TimeBox Manager"
3. Click the X icon OR toggle it off
4. Optionally delete: `.obsidian/plugins/timebox-manager/` folder
5. Your TimeBox notes in the vault will remain (safe to keep or delete)

## 💡 Tips for Getting Started

1. **Start Simple**: Use the default template for the first week
2. **Review Daily**: Spend 5 minutes each evening reviewing your TimeBox
3. **Customize Gradually**: Add or modify sections as you discover your needs
4. **Use Consistently**: The rollover feature works best with daily use
5. **Experiment**: Try different time block structures to find what works for you

## 🎯 Next Steps

After installation:

1. Read the main README.md for feature details
2. Open your first TimeBox and start planning
3. Experiment with the template
4. Join the community discussions
5. Share your custom templates!

## 📞 Getting Help

- **GitHub Issues**: Report bugs or request features
- **Obsidian Forum**: Ask questions and share tips
- **Discord**: Join the Obsidian community

---

**Happy TimeBoxing! 🎉**

Remember: The best productivity system is the one you actually use. Start with the basics and build from there.
