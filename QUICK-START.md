# TimeBox Daily - Quick Start Guide

## What is TimeBoxing?

TimeBoxing is a time management technique where you allocate fixed time periods (time boxes) to specific activities. This plugin automates your daily TimeBox workflow in Obsidian.

## 5-Minute Setup

### 1. Install the Plugin

```
YourVault/.obsidian/plugins/timebox-daily/
```

Copy the plugin files here, run `npm install && npm run build`, then enable in Obsidian settings.

### 2. Configure Your Preferences

Open Settings → TimeBox Daily:
- ✅ **Auto-open on startup**: ON
- ✅ **Carry forward tasks**: ON  
- ✅ **Carry forward brain dumps**: ON
- 📁 **TimeBox folder**: "TimeBox" (or your preference)

### 3. Customize Your Template (Optional)

The default template includes:
- 🎯 Today's Focus
- ⏰ Morning/Afternoon/Evening time blocks
- 📝 General tasks
- 🧠 Brain dump area
- 📊 Daily review

Modify in settings to match your workflow!

### 4. Start Using It

**Open Obsidian** → Your TimeBox opens automatically!

## Daily Workflow

### Morning Routine (5 minutes)

1. **Review Carried Forward Items**
   - Check tasks from yesterday
   - Review brain dump notes
   - Decide what to tackle today

2. **Set Your Focus**
   - Write 1-3 main goals for the day
   - Be realistic about what you can achieve

3. **Plan Time Blocks**
   - Assign specific tasks to time periods
   - Leave buffer time between blocks
   - Don't overpack your schedule

### During the Day

- ✅ Check off completed tasks as you go
- 💡 Capture ideas immediately in Brain Dump
- 📝 Add new tasks as they come up
- ⏰ Use time blocks to maintain focus

### Evening Routine (5 minutes)

1. **Complete Daily Review**
   - What went well today?
   - What could be improved?
   - What are tomorrow's priorities?

2. **Let the Plugin Work**
   - Leave incomplete tasks unchecked
   - They'll automatically carry forward tomorrow
   - Brain dump items also move forward

## Key Features

### Auto-Open on Startup
Every time you open Obsidian, today's TimeBox opens automatically. No more searching for your daily note!

### Smart Carry Forward
- **Incomplete Tasks**: Any `- [ ]` checkbox that's unchecked
- **Brain Dump Items**: Notes from your brain dump section
- **Organized**: Appears in "📤 Carried Forward" section

### Quick Access
- 📌 **Ribbon Icon**: Click calendar-clock icon
- ⌨️ **Command Palette**: `Ctrl/Cmd + P` → "Open today's TimeBox"
- 🔄 **Manual Carry Forward**: Command palette → "Carry forward incomplete items"

## Time Block Strategy

### Effective Time Blocking

**Morning (High Energy)**
- Deep work
- Complex problem-solving
- Creative tasks
- Important meetings

**Afternoon (Moderate Energy)**
- Collaborative work
- Routine tasks
- Research
- Planning

**Evening (Lower Energy)**
- Admin work
- Review and reflection
- Reading
- Light tasks

### Time Block Tips

1. **Be Specific**: "Review investor deck" not "work on deck"
2. **Realistic Duration**: Add 25% buffer to your estimates
3. **Include Breaks**: Rest is productive too
4. **Protect Deep Work**: Block distractions during focus time
5. **Review Daily**: Learn from what works and what doesn't

## Task Management

### Good Task Format
```markdown
- [ ] Send investor deck to Sarah (30 min)
- [ ] Review SQLite implementation with team (1 hour)
- [ ] Update budget spreadsheet with Q1 actuals (45 min)
```

### Tips for Better Tasks
- ✅ Include estimated time
- ✅ Make them actionable (start with a verb)
- ✅ Be specific enough that you'll remember context
- ✅ Break large tasks into smaller chunks

## Brain Dump Usage

Your brain dump is a **capture zone** for:
- 💡 Random ideas
- 🤔 Things to research later
- 📞 People to follow up with
- 🎯 Future project ideas
- 🔧 Technical problems to solve
- 📚 Things to learn

**Don't filter** - just capture everything. Review weekly.

## Customization Ideas

### For Developers
```markdown
## 🐛 Bugs to Fix
- [ ] 

## 💻 Code to Write
- [ ] 

## 📖 To Learn
- [ ] 
```

### For Entrepreneurs
```markdown
## 💼 Business Development
- [ ] 

## 💰 Financial Tasks
- [ ] 

## 👥 Team Management
- [ ] 
```

### For Students
```markdown
## 📚 Study Sessions
- [ ] 

## 📝 Assignments Due
- [ ] 

## 🎯 Exam Prep
- [ ] 
```

## Advanced Tips

### Weekly Review
Every Sunday, review your TimeBoxes:
- What patterns do you notice?
- Are you consistently overestimating/underestimating time?
- What tasks keep carrying forward? (Maybe break them down)
- What's working well?

### Integration with Other Notes
Link to other notes in your vault:
```markdown
- [ ] Review [[Project Alpha]] requirements
- [ ] Update [[Meeting Notes - Investor Call]]
- [ ] Continue work on [[Charge&Go Development Log]]
```

### Energy Tracking
Add energy ratings to understand your patterns:
```markdown
**Morning Energy**: ⚡⚡⚡⚡⚡ (5/5)
**Afternoon Energy**: ⚡⚡⚡ (3/5)
**Evening Energy**: ⚡⚡ (2/5)
```

### Templates for Different Days
Create variations in your template for:
- Monday (planning focus)
- Wednesday (midweek check-in)
- Friday (weekly review)
- Weekend (personal projects)

## Common Questions

**Q: Can I have multiple TimeBox folders?**
A: The plugin uses one folder, but you can organize by month/year manually.

**Q: What if I miss a day?**
A: Items carry forward from the most recent previous day. Create yesterday's TimeBox if needed.

**Q: Can I customize which sections carry forward?**
A: Currently tasks and brain dumps. Custom sections coming in future versions.

**Q: Does this work on mobile?**
A: Yes! The plugin works on Obsidian mobile apps.

**Q: Can I use this with Obsidian templates?**
A: Yes, but the plugin template takes precedence for new TimeBoxes.

## Best Practices

1. **Start Simple**: Use the default template, adjust as needed
2. **Be Consistent**: Review daily even if the day didn't go as planned
3. **Be Honest**: Record what actually happened, not what you wish happened
4. **Iterate Weekly**: Refine your approach based on what you learn
5. **Don't Overschedule**: Leave unscheduled time for flexibility
6. **Capture Everything**: Trust the system to carry forward important items

## Keyboard Shortcuts (Suggested)

Set up hotkeys in Obsidian Settings → Hotkeys:
- `Ctrl/Cmd + Shift + T` → Open today's TimeBox
- `Ctrl/Cmd + Shift + Y` → Carry forward from yesterday

## Getting Maximum Value

### Week 1: Learn the Basics
- Use default template
- Focus on capturing tasks and time blocks
- Get comfortable with the workflow

### Week 2: Refine Your System
- Adjust time block durations
- Customize template sections
- Find your optimal review timing

### Week 3: Optimize
- Notice patterns in your productivity
- Refine task granularity
- Develop personal productivity insights

### Month 1+: Master Your System
- Your TimeBox becomes second nature
- You'll know exactly how long things take
- You'll plan more realistically
- You'll accomplish more with less stress

---

**Remember**: The goal isn't perfection—it's progress. Even on "bad" days, the practice of planning and reviewing builds better habits.

**Happy TimeBoxing!** ⏰📦
