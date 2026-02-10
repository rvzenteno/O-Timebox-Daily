# Git Quick Reference - TimeBox Daily

## 🚀 Quick Push (First Time)

### Method 1: Use the Automated Script

**Windows:**
```cmd
cd path\to\timebox-plugin
push-to-github.bat
```

**Mac/Linux:**
```bash
cd /path/to/timebox-plugin
chmod +x push-to-github.sh
./push-to-github.sh
```

### Method 2: Manual Commands

```bash
# 1. Navigate to plugin folder
cd /path/to/timebox-plugin

# 2. Initialize Git
git init

# 3. Add all files
git add .

# 4. Create first commit
git commit -m "Initial commit: TimeBox Daily v1.2.0"

# 5. Add GitHub remote
git remote add origin https://github.com/rvzenteno/O-Timebox-Daily.git

# 6. Rename branch to main (if needed)
git branch -M main

# 7. Push to GitHub
git push -u origin main
```

---

## 📝 Common Git Commands

### Check Status
```bash
git status                 # See what files changed
git status --short         # Compact view
```

### Add Files
```bash
git add .                  # Add all files
git add filename.ts        # Add specific file
git add *.ts              # Add all TypeScript files
```

### Commit Changes
```bash
git commit -m "Your message here"
git commit -m "feat: Add new feature"
git commit -m "fix: Bug fix description"
```

### View History
```bash
git log                    # Full history
git log --oneline         # Compact history
git log --oneline -5      # Last 5 commits
```

### Push/Pull
```bash
git push                   # Push changes
git pull                   # Pull changes from GitHub
git pull origin main       # Pull specific branch
```

### Branches
```bash
git branch                 # List branches
git branch -M main        # Rename current branch
git checkout -b new-branch # Create and switch to new branch
```

### Remote Management
```bash
git remote -v             # Show remotes
git remote add origin URL  # Add remote
git remote remove origin   # Remove remote
git remote set-url origin URL  # Change remote URL
```

---

## 🔄 Daily Workflow

### Making Changes and Pushing

```bash
# 1. Check what changed
git status

# 2. Add your changes
git add .

# 3. Commit with message
git commit -m "Describe what you changed"

# 4. Push to GitHub
git push
```

### Commit Message Conventions

```bash
# Features
git commit -m "feat: Add carry forward feature"

# Bug fixes
git commit -m "fix: Resolve duplicate detection issue"

# Documentation
git commit -m "docs: Update README with new examples"

# Refactoring
git commit -m "refactor: Improve code organization"

# Performance
git commit -m "perf: Optimize file reading speed"

# Tests
git commit -m "test: Add unit tests for carry forward"
```

---

## 🏷️ Creating Releases

### Step 1: Tag Your Version
```bash
# Create annotated tag
git tag -a v1.2.0 -m "Release v1.2.0: Multi-day carry forward"

# Push tag to GitHub
git push origin v1.2.0

# Or push all tags
git push --tags
```

### Step 2: Build Plugin
```bash
npm install
npm run build
```

### Step 3: Create Release on GitHub
1. Go to: https://github.com/rvzenteno/O-Timebox-Daily/releases
2. Click "Draft a new release"
3. Choose tag: v1.2.0
4. Release title: TimeBox Daily v1.2.0
5. Upload files: `main.js`, `manifest.json`, `styles.css`
6. Publish

---

## 🔧 Troubleshooting

### Authentication Issues

**Problem**: Git asks for password but rejects it
**Solution**: Use Personal Access Token instead of password

```bash
# Create token at: https://github.com/settings/tokens
# Use token as password when prompted
```

### Already Exists Error

**Problem**: `remote origin already exists`
**Solution**:
```bash
git remote remove origin
git remote add origin https://github.com/rvzenteno/O-Timebox-Daily.git
```

### Push Rejected

**Problem**: `Updates were rejected`
**Solution**:
```bash
# Pull first, then push
git pull origin main --allow-unrelated-histories
git push origin main
```

### Merge Conflicts

**Problem**: Files have conflicts
**Solution**:
```bash
# View conflicted files
git status

# Edit files to resolve conflicts
# Look for: <<<<<<< HEAD, =======, >>>>>>>

# After resolving:
git add .
git commit -m "Resolve merge conflicts"
git push
```

### Undo Last Commit (Not Pushed)

```bash
# Undo commit but keep changes
git reset --soft HEAD~1

# Undo commit and discard changes
git reset --hard HEAD~1
```

### Discard Local Changes

```bash
# Discard all changes
git reset --hard HEAD

# Discard changes to specific file
git checkout -- filename.ts
```

---

## 📋 Pre-Push Checklist

Before pushing to GitHub:

- [ ] All files saved
- [ ] Code builds successfully (`npm run build`)
- [ ] README is up to date
- [ ] Version number updated in manifest.json
- [ ] Commit message is descriptive
- [ ] No sensitive data (passwords, tokens) in code
- [ ] .gitignore is properly configured

---

## 🔐 GitHub Token Setup

### Create Token:
1. Go to: https://github.com/settings/tokens
2. Click "Generate new token (classic)"
3. Name: `TimeBox Daily Development`
4. Scopes: Check `repo`
5. Generate and COPY token

### Save Token (Optional):
```bash
# Remember credentials
git config --global credential.helper store

# Next push will ask for token once, then remember it
```

---

## 🎯 Quick Commands Reference

| Task | Command |
|------|---------|
| **Check status** | `git status` |
| **Add all files** | `git add .` |
| **Commit** | `git commit -m "message"` |
| **Push** | `git push` |
| **Pull** | `git pull` |
| **View log** | `git log --oneline` |
| **Create branch** | `git checkout -b branch-name` |
| **Switch branch** | `git checkout branch-name` |
| **Tag version** | `git tag -a v1.2.0 -m "Release"` |
| **Push tags** | `git push --tags` |
| **Undo last commit** | `git reset --soft HEAD~1` |
| **Discard changes** | `git reset --hard HEAD` |

---

## 📖 Resources

- **Git Documentation**: https://git-scm.com/doc
- **GitHub Guides**: https://guides.github.com/
- **Git Cheat Sheet**: https://education.github.com/git-cheat-sheet-education.pdf
- **Obsidian Plugin Dev**: https://docs.obsidian.md/

---

## 🎓 Learning Path

### Beginner
1. ✅ Push code to GitHub (you're here!)
2. ✅ Make commits
3. ✅ Create releases

### Intermediate
- Learn branching for features
- Use pull requests
- Collaborate with others

### Advanced
- Set up CI/CD
- Automated testing
- Versioning strategies

---

**Repository**: https://github.com/rvzenteno/O-Timebox-Daily
**Your Next Steps**: Push your code → Create release → Share with community!
