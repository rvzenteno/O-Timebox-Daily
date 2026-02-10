# TimeBox Daily Plugin - Complete Package

## 📦 What You're Getting

A fully functional Obsidian plugin that implements the TimeBox time management system with automatic carry-forward functionality.

## 🎯 Core Features

### 1. Auto-Open on Startup
- When you open Obsidian, today's TimeBox automatically opens
- No more hunting for your daily note
- Customizable in settings

### 2. Smart Carry Forward
The plugin automatically moves forward:
- ✅ **Incomplete Tasks**: Any unchecked `- [ ]` items
- 💭 **Brain Dump Items**: Content from your brain dump section
- 📋 **Organization**: Creates a "📤 Carried Forward from Yesterday" section

### 3. Daily TimeBox Structure
Each day gets a file named `YYYY-MM-DD.md` with:
- 🎯 Today's Focus
- ⏰ Time Blocks (Morning/Afternoon/Evening)
- 📝 Task Lists
- 🧠 Brain Dump Area
- 📊 Daily Review Section

### 4. Quick Access
- Ribbon icon (calendar-clock)
- Command palette commands
- Keyboard shortcuts (customizable)

## 📁 Files Included

### Core Plugin Files
- **main.ts** - Main plugin logic (10KB, ~350 lines)
- **manifest.json** - Plugin metadata
- **styles.css** - Custom styling
- **package.json** - Dependencies
- **tsconfig.json** - TypeScript configuration
- **esbuild.config.mjs** - Build configuration
- **version-bump.mjs** - Version management
- **versions.json** - Version tracking

### Documentation
- **README.md** - Comprehensive documentation with features, usage, customization
- **INSTALLATION_NEW.md** - Step-by-step installation guide
- **QUICK-START.md** - 5-minute setup and daily workflow guide
- **EXAMPLE-TIMEBOX.md** - Real example showing what a TimeBox looks like

## 🚀 Installation (Quick Version)

### Option 1: Full Build (Recommended)
```bash
# 1. Copy plugin to your vault
# Path: YourVault/.obsidian/plugins/timebox-daily/

# 2. Install and build
cd /path/to/vault/.obsidian/plugins/timebox-daily/
npm install
npm run build

# 3. Restart Obsidian and enable the plugin
```

### Option 2: Development Mode
```bash
npm run dev  # Watches for changes and rebuilds automatically
```

## ⚙️ Configuration Options

All configurable in Settings → TimeBox Daily:

| Setting | Default | Description |
|---------|---------|-------------|
| TimeBox Folder | "TimeBox" | Where daily files are stored |
| Auto-open on Startup | ON | Opens today's TimeBox automatically |
| Carry Forward Tasks | ON | Moves incomplete tasks forward |
| Carry Forward Brain Dumps | ON | Moves brain dump items forward |
| TimeBox Template | (built-in) | Customize your daily structure |

## 📝 Daily Workflow

### Morning (5 min)
1. Open Obsidian → TimeBox opens automatically
2. Review carried forward items from yesterday
3. Set 1-3 main goals for today
4. Plan your time blocks

### During Day
- Check off completed tasks
- Capture ideas in brain dump
- Stay focused using time blocks

### Evening (5 min)
1. Complete daily review
2. Leave incomplete tasks unchecked
3. Plugin automatically carries them forward tomorrow

## 🔧 Customization Examples

### For Software Engineers
```markdown
## 🐛 Bug Fixes
- [ ] 

## 💻 Feature Development
- [ ] 

## 📖 Learning & Research
- [ ] 

## 👥 Code Reviews & Meetings
- [ ] 
```

### For Entrepreneurs
```markdown
## 💼 Business Development
- [ ] 

## 💰 Financial Tasks
- [ ] 

## 👥 Team & Hiring
- [ ] 

## 🎯 Product Development
- [ ] 
```

### For Project Managers
```markdown
## 📊 Project Status Updates
- [ ] 

## 👥 Team Sync Meetings
- [ ] 

## 📋 Planning & Documentation
- [ ] 

## 🔥 Issue Resolution
- [ ] 
```

## 🎓 Key Concepts

### TimeBoxing Methodology
- **Time Blocks**: Fixed periods for specific work (e.g., 9-11am: Deep work)
- **Task Lists**: What needs to be done (not necessarily time-specific)
- **Brain Dump**: Capture everything to free your mind
- **Daily Review**: Reflect and improve

### Why This Works
1. **Reduces Decision Fatigue**: Pre-plan your day
2. **Manages Energy**: Match tasks to energy levels
3. **Creates Accountability**: Written commitments
4. **Enables Learning**: Reviews help you improve
5. **Captures Everything**: Nothing gets lost

## 💡 Pro Tips

### Week 1: Foundation
- Use the default template as-is
- Get comfortable with the basic workflow
- Don't overthink it

### Week 2-4: Refinement
- Notice what time estimates are accurate
- Adjust time block durations
- Customize template sections
- Find your optimal review timing

### Month 2+: Mastery
- Develop personal productivity insights
- Know exactly how long things take
- Plan more realistically
- Feel more in control

## 🛠️ Technical Details

### Built With
- TypeScript
- Obsidian API
- esbuild (bundling)
- Moment.js (date handling)

### Plugin Architecture
```
TimeBoxPlugin
├── Settings Management
├── File Operations (create, read, modify)
├── Carry Forward Logic
│   ├── Task Detection (- [ ] patterns)
│   └── Brain Dump Extraction
├── Date Utilities
└── UI Integration (ribbon, commands, settings)
```

### File Naming Convention
- Format: `YYYY-MM-DD.md`
- Example: `2025-01-12.md`
- Stored in: `TimeBox/` folder (configurable)

### Carry Forward Algorithm
1. Read yesterday's file
2. Parse for unchecked tasks (`- [ ]`)
3. Extract brain dump section content
4. Format as "Carried Forward" section
5. Prepend to today's TimeBox

## 📊 Use Cases

### Software Development
- Daily standup preparation
- Sprint task tracking
- Bug triage organization
- Learning time allocation

### Entrepreneurship
- Investor meeting prep
- Product roadmap tracking
- Team coordination
- Financial task management

### Project Management
- Stakeholder updates
- Risk mitigation tracking
- Resource allocation planning
- Meeting preparation

### Academic/Research
- Study session planning
- Research task tracking
- Literature review organization
- Thesis/dissertation progress

## 🔒 Privacy & Data

- All data stored locally in your vault
- No external connections
- No telemetry or tracking
- Full control over your information

## 🤝 Support & Contribution

### Getting Help
1. Check QUICK-START.md
2. Review README.md
3. See INSTALLATION_NEW.md
4. Check example in EXAMPLE-TIMEBOX.md

### Contributing
The plugin is open source and welcomes contributions:
- Bug fixes
- Feature enhancements
- Documentation improvements
- Template examples

## 📈 Success Metrics

After using TimeBox Daily for a month, you should notice:
- ✅ More tasks completed consistently
- ✅ Better time estimation skills
- ✅ Less mental clutter
- ✅ Improved work-life balance
- ✅ Clearer priorities
- ✅ More realistic planning

## 🎯 Philosophy

**The goal isn't perfect planning—it's intentional living.**

TimeBoxing helps you:
- Be proactive instead of reactive
- Make conscious choices about your time
- Learn from experience
- Stay focused on what matters
- Feel accomplished at day's end

## 📚 Additional Resources

### Recommended Reading
- "Deep Work" by Cal Newport
- "Getting Things Done" by David Allen
- "The One Thing" by Gary Keller
- "Atomic Habits" by James Clear

### Time Management Techniques
- Pomodoro Technique (25-min focused work)
- Time Blocking (this plugin!)
- 2-Minute Rule (quick tasks immediately)
- Eisenhower Matrix (priority management)

## 🏁 Next Steps

1. **Install** the plugin following INSTALLATION_NEW.md
2. **Configure** your preferences in settings
3. **Start** with the default template
4. **Use** it for one week without changes
5. **Review** your experience
6. **Customize** based on what you learned
7. **Iterate** and improve your system

---

## 📦 Package Contents Summary

```
timebox-plugin/
├── Core Files
│   ├── main.ts (plugin logic)
│   ├── manifest.json
│   ├── styles.css
│   ├── package.json
│   └── build configs
├── Documentation
│   ├── README.md (full documentation)
│   ├── INSTALLATION_NEW.md (setup guide)
│   ├── QUICK-START.md (daily workflow)
│   └── EXAMPLE-TIMEBOX.md (sample)
└── Support Files
    ├── .gitignore
    └── version management
```

## ✨ Final Notes

This plugin was designed with **your workflow** in mind:
- As a Plumbing Design Engineer managing complex projects
- As someone working on Charge&Go with investor timelines
- As a systems engineer who appreciates good tooling
- As a programmer who values automation
- As someone juggling multiple responsibilities

The TimeBox system will help you:
- Keep Charge&Go development on track
- Manage CPDT certification studying
- Balance work across multiple projects
- Never lose track of important tasks
- Make steady progress toward your $1.5M seed funding goal

**Your time is valuable. This plugin helps you use it wisely.**

---

**Start TimeBoxing today and take control of your schedule!** ⏰📦

For questions or issues, check the documentation files or reach out for support.

**Built with ⚡ for productive professionals**
