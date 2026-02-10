# TimeBox Daily - Obsidian Plugin

![Version](https://img.shields.io/badge/version-1.2.0-blue.svg)
![Obsidian](https://img.shields.io/badge/Obsidian-0.15.0+-purple.svg)
![License](https://img.shields.io/badge/license-MIT-green.svg)

A powerful Obsidian plugin for daily time management using the TimeBox methodology. Features automatic daily file creation, smart task carry-forward with 14-day lookback, and intelligent duplicate detection.

## ✨ Features

- 🗓️ **Auto-open on Startup**: Automatically opens today's TimeBox when Obsidian starts
- 📤 **Smart Multi-Day Carry Forward**: Searches back up to 14 days to find incomplete tasks
- 🎯 **Duplicate Detection**: Automatically removes duplicate tasks when aggregating from multiple days
- ⏰ **Time Block Exclusion**: Time-specific tasks (Morning/Afternoon/Evening) stay in their original day
- 🧠 **Brain Dump Section**: Separate section for quick thoughts and ideas
- 📝 **Customizable Templates**: Personalize your daily TimeBox structure
- 🎨 **Clean Markdown**: Pure markdown workflow, perfect for mobile

## 🆕 What's New in v1.2.0

### Multi-Day Carry Forward
Never lose tasks after weekends or vacations! The plugin now:
- Searches backwards up to **14 days** for incomplete tasks
- Aggregates tasks from **all skipped days**
- Automatically **removes duplicates**
- Perfect for handling weekends, vacations, and sick days

**Example:**
```
Friday:    [ ] Task A, [ ] Task B
Saturday:  (no file)
Sunday:    (no file)
Monday:    Task A + Task B automatically appear! ✅
```

[Read the full changelog →](CHANGELOG-MULTI-DAY.md)

## 📦 Installation

### From GitHub Releases

1. Download the latest release from [Releases](https://github.com/rvzenteno/O-Timebox-Daily/releases)
2. Extract to: `YourVault/.obsidian/plugins/timebox-daily/`
3. In the plugin folder, run:
   ```bash
   npm install
   npm run build
   ```
4. Restart Obsidian
5. Enable "TimeBox Daily" in Settings → Community Plugins

### Manual Installation

1. Clone this repository:
   ```bash
   git clone https://github.com/rvzenteno/O-Timebox-Daily.git
   cd O-Timebox-Daily
   ```

2. Install dependencies and build:
   ```bash
   npm install
   npm run build
   ```

3. Copy the built files to your Obsidian plugins folder:
   ```bash
   cp main.js manifest.json styles.css /path/to/vault/.obsidian/plugins/timebox-daily/
   ```

4. Restart Obsidian and enable the plugin

## 🚀 Quick Start

1. **First Launch**: After enabling the plugin, Obsidian will automatically create your first TimeBox
2. **Daily Workflow**: 
   - Open Obsidian → Today's TimeBox opens automatically
   - Plan your day using the time blocks
   - Check off completed tasks
   - Leave incomplete tasks unchecked (they'll carry forward)
3. **Weekend Returns**: When you open Obsidian on Monday, tasks from Friday automatically appear!

## 📚 Documentation

- [Quick Start Guide](QUICK-START.md) - Get up and running in 5 minutes
- [Installation Guide](INSTALLATION.md) - Detailed installation instructions
- [Multi-Day Feature Guide](CHANGELOG-MULTI-DAY.md) - How the 14-day lookback works
- [Example TimeBox](EXAMPLE-TIMEBOX.md) - See what a daily TimeBox looks like

## ⚙️ Settings

Configure TimeBox Daily in Settings → TimeBox Daily:

- **TimeBox Folder**: Where daily files are stored (default: `TimeBox`)
- **Auto-open on Startup**: Automatically open today's TimeBox (default: ON)
- **Carry Forward Tasks**: Move incomplete tasks to today (default: ON)
- **Carry Forward Brain Dumps**: Move brain dump items to today (default: ON)
- **TimeBox Template**: Customize your daily template

## 🎯 Use Cases

### Perfect For:
- ✅ **Professionals** who work Monday-Friday and need weekend-proof task management
- ✅ **Freelancers** with irregular schedules and gaps between work days
- ✅ **Students** who take breaks between study sessions
- ✅ **Anyone** who wants simple, markdown-based time management

### Great For Handling:
- 🏖️ Weekends (2-day gaps)
- 🌴 Vacations (up to 14 days)
- 🤒 Sick days
- 📅 Holidays
- ⏸️ Any work interruption

## 📋 Example Daily TimeBox

```markdown
# TimeBox - Tuesday, January 27th 2026

## 📤 Carried Forward from Previous Days

### Incomplete Tasks
- [ ] Review Q4 financial reports
- [ ] Call investor about Series A
- [ ] Update company roadmap

## 🎯 Today's Focus
What are the 1-3 most important things to accomplish today?

## ⏰ Time Blocks

### Morning (6:00 - 12:00)
- [ ] 8:20am - 9:20am - LDC meeting
- [ ] 10:00am - 11:30am - Deep work session

### Afternoon (12:00 - 18:00)
- [ ] 2:00pm - 3:00pm - Team sync
- [ ] 4:00pm - 5:00pm - Investor prep

### Evening (18:00 - 22:00)
- [ ] Review the day
- [ ] Plan tomorrow

## 📝 Tasks
- [ ] Task 1
- [ ] Task 2

## 🧠 Brain Dump
Random thoughts, ideas, or things to remember

## 📊 Daily Review
What went well? What could be improved?
```

## 🔧 Development

### Prerequisites
- Node.js v16 or higher
- npm

### Setup Development Environment
```bash
# Clone the repository
git clone https://github.com/rvzenteno/O-Timebox-Daily.git
cd O-Timebox-Daily

# Install dependencies
npm install

# Build the plugin
npm run build

# Watch for changes (development mode)
npm run dev
```

### Project Structure
```
O-Timebox-Daily/
├── main.ts              # Plugin source code
├── manifest.json        # Plugin metadata
├── styles.css           # Plugin styles
├── package.json         # Node dependencies
├── tsconfig.json        # TypeScript config
├── esbuild.config.mjs   # Build configuration
└── README.md            # This file
```

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## 📝 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- Built with [Obsidian API](https://github.com/obsidianmd/obsidian-api)
- Inspired by the TimeBox time management methodology
- Created to solve the real-world problem of task continuity across work breaks

## 📧 Contact

Victor - [@rvzenteno](https://github.com/rvzenteno)

Project Link: [https://github.com/rvzenteno/O-Timebox-Daily](https://github.com/rvzenteno/O-Timebox-Daily)

## 🌟 Support

If you find this plugin helpful, please consider:
- ⭐ Starring the repository
- 🐛 Reporting bugs in [Issues](https://github.com/rvzenteno/O-Timebox-Daily/issues)
- 💡 Suggesting new features
- 🔀 Contributing code

---

**Note**: This plugin is in active development. While it's stable for daily use, expect occasional updates and improvements!
