#!/bin/bash

# TimeBox Daily - Automated GitHub Push Script
# This script will push your plugin to: https://github.com/rvzenteno/O-Timebox-Daily.git

set -e  # Exit on any error

echo "🚀 TimeBox Daily - GitHub Push Script"
echo "======================================"
echo ""

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Configuration
REPO_URL="https://github.com/rvzenteno/O-Timebox-Daily.git"
BRANCH="main"
COMMIT_MESSAGE="Initial commit: TimeBox Daily v1.2.0 with multi-day carry forward"

# Function to print colored output
print_success() {
    echo -e "${GREEN}✓ $1${NC}"
}

print_info() {
    echo -e "${BLUE}ℹ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠ $1${NC}"
}

print_error() {
    echo -e "${RED}✗ $1${NC}"
}

# Check if we're in the right directory
if [ ! -f "manifest.json" ]; then
    print_error "Error: manifest.json not found!"
    print_info "Please run this script from the timebox-plugin directory"
    exit 1
fi

print_success "Found manifest.json - in correct directory"
echo ""

# Check if Git is installed
if ! command -v git &> /dev/null; then
    print_error "Git is not installed!"
    print_info "Please install Git from: https://git-scm.com/downloads"
    exit 1
fi

print_success "Git is installed"
echo ""

# Step 1: Initialize Git repository (if not already initialized)
print_info "Step 1: Initializing Git repository..."
if [ -d ".git" ]; then
    print_warning "Git repository already initialized"
else
    git init
    print_success "Git repository initialized"
fi
echo ""

# Step 2: Check if README-GITHUB.md exists and use it
print_info "Step 2: Setting up README..."
if [ -f "README-GITHUB.md" ]; then
    print_info "Found README-GITHUB.md - using it as main README"
    cp README-GITHUB.md README.md
    print_success "README.md updated with GitHub-ready version"
else
    print_warning "README-GITHUB.md not found, using existing README.md"
fi
echo ""

# Step 3: Add all files
print_info "Step 3: Adding files to Git..."
git add .
print_success "All files staged for commit"
echo ""

# Step 4: Show what will be committed
print_info "Files to be committed:"
git status --short
echo ""

# Step 5: Create commit
print_info "Step 4: Creating commit..."
if git rev-parse --verify HEAD >/dev/null 2>&1; then
    print_warning "Commits already exist in repository"
    read -p "Enter commit message (or press Enter to skip): " custom_message
    if [ -n "$custom_message" ]; then
        git add .
        git commit -m "$custom_message"
        print_success "New commit created"
    else
        print_info "Skipping new commit"
    fi
else
    git commit -m "$COMMIT_MESSAGE"
    print_success "Initial commit created"
fi
echo ""

# Step 6: Check and add remote
print_info "Step 5: Setting up GitHub remote..."
if git remote | grep -q "^origin$"; then
    EXISTING_REMOTE=$(git remote get-url origin)
    if [ "$EXISTING_REMOTE" != "$REPO_URL" ]; then
        print_warning "Remote 'origin' exists but points to different URL"
        print_info "Existing: $EXISTING_REMOTE"
        print_info "Expected: $REPO_URL"
        read -p "Update remote URL? (y/n): " update_remote
        if [ "$update_remote" = "y" ]; then
            git remote set-url origin "$REPO_URL"
            print_success "Remote URL updated"
        fi
    else
        print_success "Remote 'origin' already configured correctly"
    fi
else
    git remote add origin "$REPO_URL"
    print_success "Remote 'origin' added"
fi
echo ""

# Step 7: Check current branch name
print_info "Step 6: Checking branch name..."
CURRENT_BRANCH=$(git branch --show-current)
if [ "$CURRENT_BRANCH" != "$BRANCH" ]; then
    print_info "Current branch: $CURRENT_BRANCH"
    print_info "Renaming to: $BRANCH"
    git branch -M "$BRANCH"
    print_success "Branch renamed to $BRANCH"
else
    print_success "Already on branch: $BRANCH"
fi
echo ""

# Step 8: Push to GitHub
print_info "Step 7: Pushing to GitHub..."
print_warning "You may be asked for your GitHub credentials:"
print_info "  Username: rvzenteno"
print_info "  Password: Use a Personal Access Token (NOT your GitHub password)"
print_info "  Token can be created at: https://github.com/settings/tokens"
echo ""

read -p "Ready to push? (y/n): " confirm_push
if [ "$confirm_push" = "y" ]; then
    if git push -u origin "$BRANCH"; then
        print_success "Successfully pushed to GitHub!"
        echo ""
        print_success "🎉 Your repository is now live at:"
        print_info "   $REPO_URL"
        echo ""
        print_info "Next steps:"
        echo "  1. Visit: https://github.com/rvzenteno/O-Timebox-Daily"
        echo "  2. Verify all files are there"
        echo "  3. Create a release (see HOW-TO-PUSH-TO-GITHUB.md)"
        echo "  4. Share your plugin with others!"
    else
        print_error "Push failed!"
        print_info "Common issues:"
        echo "  - Authentication failed: Make sure you're using a Personal Access Token"
        echo "  - Remote rejected: Repository might not be empty (pull first)"
        echo ""
        print_info "Try these commands manually:"
        echo "  git pull origin main --allow-unrelated-histories"
        echo "  git push -u origin main"
        exit 1
    fi
else
    print_info "Push cancelled"
    print_info "You can push manually later with: git push -u origin main"
fi

echo ""
print_success "Script complete!"
