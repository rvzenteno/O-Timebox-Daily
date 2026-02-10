# TimeBox Manager - Quick Start Guide

Get up and running with TimeBox Manager in under 5 minutes!

## 🚀 Installation (Choose One Method)

### Option A: Build from Source (For Developers)

```bash
# Navigate to your Obsidian plugins folder
cd /path/to/vault/.obsidian/plugins

# Create and enter the plugin directory
mkdir timebox-manager && cd timebox-manager

# Copy all the plugin files here, then:
npm install
npm run build
```

### Option B: Manual Installation (For Users)

1. Download `main.js` and `manifest.json`
2. Create folder: `.obsidian/plugins/timebox-manager/`
3. Copy files into that folder
4. Reload Obsidian

## ✅ Enable the Plugin

1. Open Obsidian Settings (⚙️)
2. Go to **Community plugins**
3. Click **"Reload plugins"**
4. Find **"TimeBox Manager"** and toggle it **ON**

## 🎯 Your First TimeBox

After enabling, the plugin will:
1. ✨ Auto-create a `TimeBox` folder in your vault
2. 📅 Open today's TimeBox automatically
3. 🔄 Set up task rollover for tomorrow

## 💪 Daily Workflow

### Morning (2 minutes)
```
1. Open Obsidian → TimeBox opens automatically
2. Review rolled-over tasks from yesterday
3. Write your #1 focus for today
4. Fill in your time blocks
```

### During the Day
```
- ✅ Check off completed tasks
- ➕ Add new tasks as they come up
- 🧠 Brain dump random thoughts
```

### Evening (2 minutes)
```
1. Move completed tasks to "Completed Today" section
2. Leave incomplete tasks unchecked (they'll roll over)
3. Write quick reflection notes
```

## 🎨 Customize Your Template

**Settings → TimeBox Manager → Template Content**

### Example: Engineer's Template
```markdown
# TimeBox - {{date}}

## 🎯 Today's Focus
<!-- Main objective -->

## ⏰ Time Blocks

### Deep Work (6:00 AM - 9:00 AM)
- [ ] Critical coding/design work

### Meetings (9:00 AM - 12:00 PM)
- [ ] Stand-up
- [ ] 

### Focused Work (1:00 PM - 4:00 PM)
- [ ] Code review
- [ ] 

### Admin & Planning (4:00 PM - 5:00 PM)
- [ ] Emails
- [ ] Tomorrow's planning

## 📋 Tasks
### 🔥 High Priority
- [ ] 

### 📊 Medium Priority
- [ ] 

### 💡 Low Priority
- [ ] 

## 🧠 Brain Dump

## 🐛 Bugs/Issues to Track
- 

## 📚 Learning Notes

## ✅ Completed Today
```

### Example: Entrepreneur's Template
```markdown
# TimeBox - {{date}}

## 🎯 Today's Revenue Goal
$____

## ⏰ Time Blocks

### Power Hour (7:00 AM - 8:00 AM)
- [ ] Most important revenue task

### Client Work (9:00 AM - 12:00 PM)
- [ ] 

### Business Development (1:00 PM - 3:00 PM)
- [ ] Sales calls
- [ ] Marketing

### Operations (3:00 PM - 5:00 PM)
- [ ] Admin
- [ ] Planning

## 💰 Revenue Activities
- [ ] 

## 📞 Follow-ups
- [ ] 

## 📧 Communications
- [ ] 

## 🧠 Brain Dump

## 💡 Business Ideas

## ✅ Completed Today
```

## ⚡ Pro Tips

### Tip 1: Use Hotkeys
Set up hotkeys for quick access:
1. Settings → Hotkeys
2. Search "TimeBox"
3. Assign shortcut (e.g., `Ctrl/Cmd + T`)

### Tip 2: Link Related Notes
```markdown
## 📋 Tasks
- [ ] Review [[Project Alpha]] requirements
- [ ] Update [[Meeting Notes 2026-01-12]]
```

### Tip 3: Use Tags
```markdown
## 📋 Tasks
- [ ] Fix login bug #bug #urgent
- [ ] Client proposal #sales #important
```

### Tip 4: Time Block Reality Check
Don't over-schedule! Leave 20-30% buffer time:
- ✅ 4-5 tasks per time block
- ❌ 15 tasks in 3 hours

### Tip 5: Weekly Review
Every Friday/Sunday:
1. Review completed tasks from the week
2. Identify patterns (what worked/didn't)
3. Adjust your template accordingly

## 🎯 Common Use Cases

### For Students
```markdown
## 📚 Classes Today
- Math 101 (9:00 AM)
- Programming (2:00 PM)

## 📝 Assignments Due
- [ ] Essay draft (Due: Friday)
- [ ] Lab report

## 📖 Study Sessions
### Morning Study (8:00 AM - 10:00 AM)
- [ ] Review Chapter 5

### Evening Study (7:00 PM - 9:00 PM)
- [ ] Practice problems
```

### For Project Managers
```markdown
## 👥 Team Check-ins
- [ ] 1:1 with Sarah
- [ ] Sprint planning

## 📊 Projects Status
- Project A: On track ✅
- Project B: Needs attention ⚠️

## 🎯 Today's Deliverables
- [ ] Sprint report
- [ ] Budget review
```

### For Parents/Remote Workers
```markdown
## 👨‍👩‍👧 Family Time
### Morning (6:00 AM - 8:00 AM)
- [ ] Kids breakfast & school prep

### Work Blocks (9:00 AM - 3:00 PM)
- [ ] Work task 1
- [ ] Work task 2

### Family Time (3:00 PM - 6:00 PM)
- [ ] School pickup
- [ ] Activities

### Personal Time (8:00 PM - 10:00 PM)
- [ ] Side project
```

## 🔧 Settings Explained

### TimeBox Folder
- **What**: Where your daily TimeBoxes are saved
- **Default**: `TimeBox`
- **Tip**: Use `Daily/TimeBox` for organization

### Auto-open on Startup
- **What**: Opens today's TimeBox when you launch Obsidian
- **Why**: Start your day with intention
- **Disable if**: You prefer manual opening

### Rollover Incomplete Tasks
- **What**: Moves yesterday's uncompleted items to today
- **How**: Only tasks marked `- [ ]` (not completed)
- **Excludes**: Tasks in "Completed Today" section

## 🐛 Quick Troubleshooting

### Not Auto-Opening?
1. Settings → TimeBox Manager
2. Verify "Auto-open on Startup" is ON
3. Restart Obsidian completely

### Tasks Not Rolling Over?
1. Check task format: `- [ ] Task name`
2. Verify yesterday's file exists
3. Ensure setting is enabled

### Can't Find Plugin?
1. Settings → Community plugins
2. Click "Reload plugins"
3. Check if toggle is ON

## 📱 Mobile Usage

Works on mobile! Just:
1. Install on desktop first
2. Sync vault to mobile (iCloud/Dropbox/Obsidian Sync)
3. Open Obsidian mobile
4. Enable plugin in settings

## 🎓 Learn More

- **Full Documentation**: See README.md
- **Installation Help**: See INSTALLATION.md
- **Community**: Join Obsidian Discord/Forum

## 💡 Remember

> "The best productivity system is the one you actually use."

Start simple, use daily, adjust as needed. Your future self will thank you! 🙏

---

**Ready to TimeBox?** Close this guide and let's get productive! 🚀
