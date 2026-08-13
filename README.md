# TimeBox Daily

**Smart daily timeboxing for Obsidian.**  
Plan your day in structured time blocks, automatically roll over unfinished tasks, and stay focused without manual setup.

TimeBox Daily creates a consistent daily planning system inside your vault using a practical TimeBox methodology.

---

## ✨ What It Does

TimeBox Daily helps you:

- **Multi-Project Tracking & Sidebar Dashboard**: Track projects with visual progress bars and backlogs inside dedicated project notes (`TimeBox/Projects/`) and a custom right-sidebar dashboard view.
- **🗂 Collapsible Project Dashboard Cards**: Click project card headers in the sidebar dashboard to collapse or expand project tasks and focus on one project at a time.
- **🌿 Nested Subtasks & Controls**: Full checklist subtask support with expand/collapse chevron toggles, completion count badges (e.g., `1/3`), and a quick `+ Add Subtask` button.
- **🎯 6-Dot Drag-and-Drop Task Reordering**: Reorder tasks inside project cards using smooth 6-dot drag handles (`⋮⋮`), or use editor keyboard shortcuts (`Move task line up / down`).
- **📦 Collapsible Project Task Callouts (`> [!todo]-`)**: Carried-forward tasks and daily tasks linked to projects are automatically grouped into native collapsible callouts, closed by default to eliminate clutter.
- **🧹 Note Task Cleaner Command & Menu**: Editor right-click menu and command (`Group active note tasks into collapsible project callouts`) to instantly structure daily notes and group stray tasks into project callouts.
- **🔄 Bi-Directional Task Sync**: Automatically sync task completion status (`- [x]`) between Daily Notes, Project Notes, and the Projects Dashboard.
- **One-Click Task Injection (`[+ Today]`)**: Push project backlog tasks into today's TimeBox note with a single click.
- **Automatic `[[Project]]` Link Parsing**: Type `- [ ] Task [[ProjectName]]` in daily notes to auto-link and update project notes.
- **Hide/Show Completed Tasks (`👁`)**: Toggle finished tasks on or off in your sidebar project cards.
- **Smart Task Rollover**: Automatically carry forward unfinished tasks and Brain Dump items across days.
- **Structured Daily Notes**: Auto-create daily timeboxing templates with focus areas, time blocks, and notes.
- **◀▶ Navigation Links**: Click `◀ Yesterday | Tomorrow ▶` links at the top of any daily note to open or initialize yesterday's or tomorrow's note.
- **Auto-Open on Startup**: Automatically open today's TimeBox and Projects Dashboard when Obsidian launches.

It is designed for users who want structure without friction.

---

## 📸 How It Works

Each day, the plugin creates (or opens) a note like:

TimeBox - March 12, 2026

Inside, you'll have:

- 🎯 Today's Focus
- ⏰ Time Blocks (Morning / Afternoon / Evening)
- 📋 Tasks
- 🧠 Brain Dump
- 📝 Notes & Reflections
- ✅ Completed Today

Unfinished tasks automatically move to the next day.

No manual copying. No daily setup.

---

## 📦 Installation

### Install from Community Plugins (Recommended)

1. Open Settings → Community Plugins
2. Disable Safe Mode
3. Click Browse
4. Search for TimeBox Daily
5. Click Install
6. Enable the plugin

---

### Manual Installation

1. Download the latest release files:
   - main.js
   - manifest.json
   - styles.css

2. Create a folder in your vault:

.obsidian/plugins/timebox-daily

3. Copy the files into that folder.

4. Reload Obsidian and enable the plugin.

---

## 🚀 Getting Started

1. Enable the plugin.
2. A TimeBox folder will be created automatically (configurable).
3. Restart Obsidian or run the command:

Open Today's TimeBox

4. Start planning your day.

---

## 🗓 Daily Workflow

### Morning
- Open Obsidian
- Review rolled-over tasks
- Set your #1 focus
- Plan your time blocks

### During the Day
- Check off tasks
- Add new items to Brain Dump
- Adjust time blocks as needed

### End of Day
- Leave incomplete tasks unchecked
- Reflect in Notes
- Tomorrow’s note will automatically include unfinished items

---

## 🧠 Smart Task Rollover

TimeBox Daily:

- Moves incomplete tasks forward
- Prevents duplicates
- Keeps completed tasks archived
- Preserves Brain Dump continuity

You can also trigger rollover manually via the Command Palette.

---

## ⚙️ Settings

### TimeBox Folder
Choose where daily notes are stored.  
Default: TimeBox

---

### Auto-Open on Startup
Automatically opens today's TimeBox when Obsidian launches.

---

### Rollover Incomplete Tasks
Automatically carries forward unfinished tasks and Brain Dump items.

---

### Template Customization

You can fully customize your daily template.

Default structure:

# TimeBox - {{date}}

## 🎯 Today's Focus

## ⏰ Time Blocks
### Morning
- [ ]

### Afternoon
- [ ]

### Evening
- [ ]

## 📋 Tasks
- [ ]

## 🧠 Brain Dump

## 📝 Notes & Reflections

## ✅ Completed Today

Available variable:

{{date}}

---

## 🔌 Works Well With

- Dataview – Analyze productivity patterns
- Tasks – Advanced task querying
- Calendar – Visual navigation
- Daily Notes (Core Plugin) – Complementary workflows

---

## 🛠 Development

Repository:
https://github.com/rvzenteno/O-Timebox-Daily

### Build

npm install
npm run build

### Development Mode

npm run dev

---

## 🤝 Contributing

Contributions are welcome.

1. Fork the repository
2. Create a feature branch
3. Commit changes
4. Open a Pull Request

---

## 💙 Support the Project

If TimeBox Daily improves your workflow, you can:

- ⭐ Star the repository
- 🐛 Report issues
- 🔀 Contribute code
- 📢 Share it with others

You may also support development via PayPal:

[https://www.paypal.com/paypalme/victorzenteno](https://paypal.me/VictorZenteno)

---

## 📝 License

MIT License  
See LICENSE file for details.

---

## 📌 Roadmap

Planned improvements:

- Weekly & Monthly TimeBox views
- Productivity analytics
- Time tracking integration
- Pomodoro support
- Priority system
- Calendar visualization
- Export functionality

---

## Why TimeBox Daily?

Most daily note systems require manual setup.  
TimeBox Daily enforces structure automatically — so you can focus on execution, not organization.
