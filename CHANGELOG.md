# Changelog - TimeBox Daily

## [1.3.2] - 2026-08-12

### Added & Improved
- 🗂 **Collapsible Project Dashboard Cards**: Collapse/expand any project card in the sidebar to focus on one project at a time.
- 🌿 **Nested Subtasks & Task Management**: Added subtask support, expand/collapse chevron toggles, completion count badges (`1/3`), and quick `Add Subtask` button.
- 🎯 **6-Dot Drag-and-Drop Task Reordering**: Reorder tasks in project cards with smooth drag handles and editor keyboard commands (`Move task line up / down`).
- 📦 **Auto-Grouping Project Tasks into Collapsible Callouts**: Carried-forward tasks and daily note tasks linked to projects are automatically grouped into native collapsible callouts (`> [!todo]-`), while general tasks remain as standard checklists.
- 🧹 **Note Task Cleaner Command**: Editor right-click menu and command (`Group active note tasks into collapsible project callouts`) to instantly clean up and structure any daily note.
- ◀▶ **Navigation Link Fix**: Intercepts click events on `◀ Yesterday | Tomorrow ▶` links to open yesterday's or tomorrow's daily note cleanly.

---

## [1.3.1] - 2026-07-25

### Fixed
- 🛠 **Linter & Type Safety**: Resolved all 119 linter warnings, unsafe parameter casts, and DOM element helper warnings
- ⚡ **Obsidian API Compatibility**: Upgraded `minAppVersion` to `1.7.0` and replaced `revealLeaf` with `setActiveLeaf`
- ⚙️ **Settings Search**: Added `getSettingDefinitions()` method to `TimeBoxSettingTab`
- 🔒 **GitHub Release Provenance**: Enabled automated release asset overwriting and artifact attestations

---

## [1.3.0] - 2026-07-25

### Added
- 🗂 **Multi-Project Tracking**: Manage multiple project notes with real-time progress bars and task lists
- 📊 **Projects Sidebar Dashboard**: Custom Obsidian sidebar view (`ItemView`) with project cards and completion metrics
- 🔄 **Bi-Directional Task Sync**: Complete tasks in Daily Notes, Project Notes, or the Dashboard to sync `- [x]` status across the vault
- ➕ **One-Click `[+ Today]` Task Injection**: Instantly push backlog project tasks into Today's TimeBox note
- 🔗 **Automatic `[[Project]]` Link Parsing**: Type `- [ ] Task [[ProjectName]]` in any daily note to automatically link and push tasks to project notes
- ⚡ **Auto-Push New Project Tasks**: Option to automatically push new project tasks straight into Today's TimeBox note upon creation
- 👁️ **Hide/Show Completed Tasks**: Header toggle button `👁` and setting toggle to show/hide finished project tasks in dashboard cards
- 📁 **Configurable Projects Folder**: Dedicated folder configuration (`TimeBox/Projects` by default)

---

## [1.2.5] - 2026-01-27

### Added
- 💝 **Donation Support**: Added donation options in plugin settings
  - PayPal integration with direct link
  - USDC (Base Network) support with copy-to-clipboard
  - USDT (Tron TRC-20) support with copy-to-clipboard
  - Convenient buttons to copy crypto addresses
  - Info tooltips for easy reference
- 📚 **DONATIONS.md**: Comprehensive donation documentation
  - Multiple donation methods explained
  - Suggested donation tiers
  - FAQ section
  - Alternative ways to support
- 💫 **GitHub Sponsor Button**: Added FUNDING.yml for repository sponsor button
- 📖 **Updated Documentation**: README files now include donation information

### What's New in Settings
New "Support This Plugin" section with:
- One-click PayPal donation button
- Copy buttons for crypto addresses
- Helpful tooltips with full addresses
- Thank you message

---

## [1.2.0] - 2026-01-27

### Added
- 🚀 **Multi-Day Carry Forward**: Search backwards up to 14 days for incomplete tasks
- 📤 **Task Aggregation**: Combine tasks from all skipped days (weekends, vacations)
- 🔍 **Duplicate Detection**: Automatically remove duplicate tasks when aggregating
- 📅 **Weekend-Proof**: Never lose tasks after weekends or breaks

### Changed
- Updated carry forward header: "Carried Forward from Previous Days" (was "Yesterday")
- Improved performance with smart file scanning (only reads existing files)

### Technical Details
- Searches up to 14 days back for TimeBox files
- Aggregates incomplete tasks from all found days
- Uses exact string matching for duplicate detection
- Still excludes time block tasks (Morning/Afternoon/Evening)
- Brain dump items also aggregated with duplicate removal

### Documentation
- Added CHANGELOG-MULTI-DAY.md with detailed feature explanation
- Added MULTI-DAY-VISUAL-GUIDE.md with visual examples
- Updated README with new feature description

---

## [1.1.0] - 2026-01-XX

### Changed
- 🔧 **Time Block Exclusion**: Tasks in Morning/Afternoon/Evening sections no longer carry forward
  - Only general "Tasks" section and "Brain Dump" items carry forward
  - Time-specific tasks stay in their original day

### Why This Change?
Time blocks represent your specific schedule for that day. When the day ends, those time-specific tasks shouldn't automatically move forward - you should consciously re-plan each day.

### Technical
- Added section detection in carry forward logic
- Tracks when entering/exiting time block sections
- Filters tasks based on section context

---

## [1.0.0] - Initial Release

### Features
- ✅ Auto-open today's TimeBox on Obsidian startup
- ✅ Automatic daily file creation
- ✅ Carry forward incomplete tasks from yesterday
- ✅ Carry forward brain dump items
- ✅ Customizable daily template
- ✅ Time block sections (Morning/Afternoon/Evening)
- ✅ Daily focus section
- ✅ Brain dump section
- ✅ Daily review section
- ✅ Ribbon icons for quick access
- ✅ Command palette integration
- ✅ Settings panel for customization

### Settings
- TimeBox folder location
- Auto-open on startup toggle
- Carry forward tasks toggle
- Carry forward brain dumps toggle
- Template customization

---

## Release Notes Format

### Version Numbers
- **Major.Minor.Patch** (e.g., 1.2.1)
  - **Major**: Breaking changes
  - **Minor**: New features
  - **Patch**: Bug fixes and small improvements

### Categories
- **Added**: New features
- **Changed**: Changes to existing features
- **Deprecated**: Features being phased out
- **Removed**: Removed features
- **Fixed**: Bug fixes
- **Security**: Security improvements

---

## Upgrade Guide

### From 1.2.0 to 1.2.1
No action required! Simply update and enjoy the new donation options in settings.

### From 1.1.0 to 1.2.0
No action required! The multi-day carry forward feature works automatically. Your existing files are compatible.

### From 1.0.0 to 1.1.0
No action required! Time block exclusion works automatically with your existing template.

---

## Support

- 🐛 Report bugs: [GitHub Issues](https://github.com/rvzenteno/O-Timebox-Daily/issues)
- 💡 Request features: [GitHub Discussions](https://github.com/rvzenteno/O-Timebox-Daily/discussions)
- 💝 Support development: See [DONATIONS.md](DONATIONS.md)
- ⭐ Star on GitHub: [O-Timebox-Daily](https://github.com/rvzenteno/O-Timebox-Daily)

---

**Repository**: https://github.com/rvzenteno/O-Timebox-Daily
**License**: MIT
