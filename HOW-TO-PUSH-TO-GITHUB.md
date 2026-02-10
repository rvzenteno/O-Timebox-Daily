# How to Push TimeBox Daily to GitHub

This guide will walk you through pushing your TimeBox Daily plugin to your GitHub repository at: https://github.com/rvzenteno/O-Timebox-Daily.git

## 📋 Prerequisites

Before you start, make sure you have:
- ✅ Git installed on your computer ([Download Git](https://git-scm.com/downloads))
- ✅ GitHub account (you already have this)
- ✅ Repository created: https://github.com/rvzenteno/O-Timebox-Daily.git
- ✅ Unzipped `timebox-plugin-v1.2.zip` to a folder

## 🚀 Method 1: Command Line (Recommended)

### Step 1: Open Terminal

**Windows:**
- Press `Win + R`
- Type `cmd` and press Enter

**Mac/Linux:**
- Press `Cmd + Space` and type "Terminal"
- Or find Terminal in Applications

### Step 2: Navigate to Your Plugin Folder

```bash
# Navigate to where you unzipped the plugin
cd /path/to/timebox-plugin

# Example on Windows:
cd C:\Users\Victor\Downloads\timebox-plugin

# Example on Mac/Linux:
cd ~/Downloads/timebox-plugin
```

**Tip**: You can drag the folder into the terminal window to auto-fill the path!

### Step 3: Initialize Git Repository

```bash
# Initialize a new Git repository
git init

# Check current status
git status
```

You should see a list of untracked files (your plugin files).

### Step 4: Add All Files to Git

```bash
# Add all files to staging
git add .

# Check what was added
git status
```

All files should now be "staged" (ready to commit).

### Step 5: Create Your First Commit

```bash
# Commit with a message
git commit -m "Initial commit: TimeBox Daily v1.2.0 with multi-day carry forward"

# Verify the commit
git log
```

You should see your commit in the log.

### Step 6: Add Your GitHub Repository as Remote

```bash
# Add your GitHub repo as the remote origin
git remote add origin https://github.com/rvzenteno/O-Timebox-Daily.git

# Verify the remote was added
git remote -v
```

You should see:
```
origin  https://github.com/rvzenteno/O-Timebox-Daily.git (fetch)
origin  https://github.com/rvzenteno/O-Timebox-Daily.git (push)
```

### Step 7: Rename Branch to 'main' (if needed)

```bash
# Check current branch name
git branch

# If it says "master", rename to "main"
git branch -M main
```

### Step 8: Push to GitHub

```bash
# Push your code to GitHub
git push -u origin main
```

**First time?** Git will ask for your GitHub credentials:
- Username: `rvzenteno`
- Password: Use a [Personal Access Token](https://github.com/settings/tokens) (NOT your GitHub password)

### Step 9: Verify on GitHub

1. Go to: https://github.com/rvzenteno/O-Timebox-Daily
2. You should see all your files!
3. The README.md will display on the main page

## 🎯 Method 2: GitHub Desktop (Easier for Beginners)

### Step 1: Download GitHub Desktop
- Go to: https://desktop.github.com/
- Download and install

### Step 2: Sign in to GitHub Desktop
- Open GitHub Desktop
- Sign in with your GitHub account

### Step 3: Add Your Local Repository
1. Click **File** → **Add Local Repository**
2. Click **Choose...**
3. Navigate to your `timebox-plugin` folder
4. Click **Add Repository**

If you get an error saying it's not a Git repository:
1. Click **Create a repository**
2. Choose the `timebox-plugin` folder
3. Click **Create Repository**

### Step 4: Publish to GitHub
1. In GitHub Desktop, click **Publish repository**
2. Repository name: `O-Timebox-Daily`
3. Uncheck "Keep this code private" (or keep checked if you want it private)
4. Click **Publish repository**

### Step 5: Verify
Go to https://github.com/rvzenteno/O-Timebox-Daily and see your code!

## 📝 What Files Will Be Pushed?

Here's what will be in your GitHub repository:

```
O-Timebox-Daily/
├── .gitignore               ← Git ignore rules
├── README.md                ← Main GitHub README
├── LICENSE                  ← MIT License
├── manifest.json            ← Plugin metadata
├── package.json             ← Node dependencies
├── tsconfig.json            ← TypeScript config
├── esbuild.config.mjs       ← Build config
├── version-bump.mjs         ← Version utility
├── versions.json            ← Version history
├── main.ts                  ← Plugin source code
├── styles.css               ← Plugin styles
├── INSTALLATION.md          ← Installation guide
├── QUICK-START.md           ← Quick start guide
├── EXAMPLE-TIMEBOX.md       ← Example file
└── OVERVIEW.md              ← Overview document
```

## 🔒 Setting Up Personal Access Token (If Needed)

If Git asks for credentials and you don't have a token:

### Create Token:
1. Go to: https://github.com/settings/tokens
2. Click **Generate new token** → **Generate new token (classic)**
3. Name: `TimeBox Daily Development`
4. Select scopes:
   - ✅ `repo` (Full control of private repositories)
5. Click **Generate token**
6. **COPY THE TOKEN** (you won't see it again!)

### Use Token:
When Git asks for password, paste your token instead.

### Save Token (Optional):
```bash
# Configure Git to remember your credentials
git config --global credential.helper store

# Next time you push, enter your token
# Git will remember it for future pushes
```

## 🌿 Creating a .gitignore File

Before pushing, create a `.gitignore` file to exclude unnecessary files:

```bash
# Create .gitignore file
cat > .gitignore << 'EOF'
# Node modules
node_modules/

# Build outputs
*.js.map
main.js
*.js

# OS files
.DS_Store
Thumbs.db

# IDE files
.vscode/
.idea/

# Test files
*.test.ts

# Logs
*.log
npm-debug.log*
EOF
```

**Important**: We exclude `main.js` because it's a build artifact. Users will build it themselves.

## 📦 Creating Your First Release

After pushing your code, create a release:

### Step 1: Build the Plugin
```bash
npm install
npm run build
```

This creates `main.js` which users need.

### Step 2: Create Release on GitHub
1. Go to: https://github.com/rvzenteno/O-Timebox-Daily/releases
2. Click **Create a new release**
3. Tag version: `v1.2.0`
4. Release title: `TimeBox Daily v1.2.0 - Multi-Day Carry Forward`
5. Description:
   ```markdown
   ## What's New
   - 🎯 Smart 14-day lookback for incomplete tasks
   - 📤 Aggregate tasks from all skipped days
   - 🔍 Automatic duplicate detection
   - ⏰ Time block exclusion (same as before)
   
   ## Installation
   Download the files below and follow the [Installation Guide](INSTALLATION.md)
   ```
6. Upload these files:
   - `main.js`
   - `manifest.json`
   - `styles.css`
7. Click **Publish release**

## 🔄 Making Updates Later

When you make changes and want to update GitHub:

```bash
# Check what changed
git status

# Add changed files
git add .

# Commit with a descriptive message
git commit -m "Fix: Improved duplicate detection logic"

# Push to GitHub
git push origin main
```

## 🎨 Customizing README

I created `README-GITHUB.md` with badges, shields, and formatting.

**To use it:**
```bash
# Replace the basic README with the GitHub-ready one
mv README-GITHUB.md README.md

# Add and commit
git add README.md
git commit -m "docs: Update README with badges and better formatting"
git push origin main
```

## 🐛 Troubleshooting

### Error: "remote origin already exists"
```bash
git remote remove origin
git remote add origin https://github.com/rvzenteno/O-Timebox-Daily.git
```

### Error: "failed to push some refs"
```bash
# Pull first, then push
git pull origin main --allow-unrelated-histories
git push origin main
```

### Error: "Authentication failed"
- Make sure you're using a Personal Access Token, NOT your password
- Token needs `repo` scope

### Error: "Permission denied"
- Verify you own the repository
- Check your GitHub username is correct
- Ensure token hasn't expired

## ✅ Verification Checklist

After pushing, verify:

- [ ] Repository shows all files at https://github.com/rvzenteno/O-Timebox-Daily
- [ ] README.md displays correctly on the main page
- [ ] Files can be browsed and viewed
- [ ] License file is present
- [ ] Installation instructions are clear

## 🎉 Next Steps

After successfully pushing:

1. **Create a Release**: Follow the "Creating Your First Release" section above
2. **Add Topics**: On GitHub, add topics like: `obsidian`, `plugin`, `time-management`, `productivity`
3. **Write Issues**: Document any bugs or feature ideas in the Issues tab
4. **Update README**: Keep it current as you add features
5. **Share**: Tell people about your plugin!

## 📞 Need Help?

If you get stuck:
1. Check error messages carefully
2. Google the exact error message
3. Check [GitHub's documentation](https://docs.github.com/)
4. Ask in GitHub community forums

---

**Repository URL**: https://github.com/rvzenteno/O-Timebox-Daily.git

**Good luck with your first GitHub push!** 🚀
