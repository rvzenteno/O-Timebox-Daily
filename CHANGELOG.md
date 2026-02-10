# Changelog - TimeBox Daily

## [1.2.1] - 2026-01-27

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
