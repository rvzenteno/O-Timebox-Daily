# Changelog - Multi-Day Carry Forward Feature

## Version 1.2.0 (TimeBox Daily) / Version 2.2.0 (KTimeBox)
**Release Date**: January 27, 2026

### 🚀 New Feature: Smart 14-Day Lookback

**Problem Solved**: Previously, if you didn't open Obsidian for multiple days (e.g., over the weekend), incomplete tasks from Friday wouldn't carry forward to Monday. Only the immediate previous day was checked.

**New Behavior**: The plugin now intelligently searches backwards up to **14 days** to find and aggregate ALL incomplete tasks from skipped days.

---

## How It Works

### Before (v1.1 / v2.1)
```
Friday:    [ ] Task A
           [ ] Task B
Saturday:  (no file)
Sunday:    (no file)
Monday:    Creates new file with NO carried tasks ❌
```

### After (v1.2 / v2.2)
```
Friday:    [ ] Task A
           [ ] Task B
Saturday:  (no file)
Sunday:    (no file)
Monday:    Creates new file with Task A + Task B ✅
```

---

## Key Features

### 1. **14-Day Search Window**
- Looks back up to 14 days to find incomplete tasks
- Searches every day in that window
- Stops searching after 14 days

### 2. **Aggregate All Skipped Days**
Combines incomplete tasks from ALL days you skipped:

```
Wednesday: [ ] Review Q4 reports
Thursday:  [ ] Call investor
           [ ] Email team update
Friday:    [ ] Finish presentation
Saturday:  (weekend - no file)
Sunday:    (weekend - no file)
Monday:    Carries forward:
           [ ] Review Q4 reports
           [ ] Call investor
           [ ] Email team update
           [ ] Finish presentation
```

### 3. **Automatic Duplicate Detection**
If the same task appears on multiple days, only ONE copy is carried forward:

```
Wednesday: [ ] Call investor
Thursday:  [ ] Call investor     ← Duplicate
Friday:    [ ] Email team
Monday:    Carries forward:
           [ ] Call investor     ← Only once!
           [ ] Email team
```

### 4. **Still Excludes Time Blocks**
Time block tasks (Morning/Afternoon/Evening) are NEVER carried forward:

```
Friday:
  Morning (6:00 - 12:00):
    [ ] 8:20am - LDC meeting    ← NOT carried forward
  
  Tasks:
    [ ] Finish Phase 5 plans    ← Carried forward ✅

Monday:
  Carried Forward:
    [ ] Finish Phase 5 plans    ← Only general tasks!
```

---

## Use Cases

### Weekend Gap
**Scenario**: Work Monday-Friday, skip weekends

```
Friday work ends → Monday work starts
Result: Friday's incomplete tasks appear on Monday
```

### Vacation
**Scenario**: Take a week off (7 days)

```
Last work day: Friday Jan 17
Return to work: Monday Jan 27 (10 days later)
Result: Friday's incomplete tasks appear on Monday Jan 27
```

### Sick Days
**Scenario**: Out sick for 3 days

```
Tuesday: Last healthy day
Wednesday-Friday: Sick (no files)
Monday: Return to work
Result: Tuesday's incomplete tasks appear on Monday
```

### Extended Break
**Scenario**: 2+ weeks off

```
Days 1-14: Plugin searches and finds tasks
Day 15+: Plugin stops searching (14-day limit)
Result: Tasks from the last 14 days are carried forward
```

---

## Technical Details

### Search Algorithm

```typescript
1. Start: Today's date
2. Loop: Check yesterday, then day before, etc.
3. For each day (up to 14 days back):
   a. Look for a TimeBox file
   b. If found, scan for incomplete tasks
   c. Add tasks to aggregate list (skip duplicates)
4. Stop: After checking 14 days
5. Return: All unique incomplete tasks found
```

### Duplicate Detection

Tasks are compared as **exact strings**:
- `- [ ] Call investor` vs `- [ ] Call investor` → Duplicate ✅
- `- [ ] Call investor` vs `- [ ] call investor` → Different ❌
- `- [ ] Call investor John` vs `- [ ] Call investor` → Different ❌

**Case-sensitive and space-sensitive matching**

### Performance

- **Fast**: Only reads files that exist
- **Efficient**: Stops at first 14 days, doesn't scan entire vault
- **Smart**: Skips days without files (no wasted processing)

---

## Settings

No new settings required! The feature works automatically with your existing configuration:

- ✅ **Carry Forward Tasks**: Must be enabled
- ✅ **Carry Forward Brain Dumps**: Optional (works the same way)
- ✅ **14-Day Lookback**: Always active, no configuration needed

---

## Examples

### Example 1: Weekend Break

**Setup**:
```
Friday Jan 24:
  Tasks:
    - [ ] Review contract
    - [ ] Update roadmap
  Brain Dump:
    - Research competitors
    - Draft Q1 goals

Saturday Jan 25: (no file)
Sunday Jan 26: (no file)
```

**Result on Monday Jan 27**:
```
Monday Jan 27:
  ## 📤 Carried Forward from Previous Days
  
  ### Incomplete Tasks
  - [ ] Review contract
  - [ ] Update roadmap
  
  ### Brain Dump Items
  - Research competitors
  - Draft Q1 goals
```

### Example 2: Multiple Days with Duplicates

**Setup**:
```
Tuesday:
  - [ ] Call investor
  - [ ] Update website

Wednesday:
  - [ ] Call investor     ← Duplicate
  - [ ] Send invoices

Thursday:
  - [ ] Update website    ← Duplicate
  - [ ] Review metrics

Friday-Sunday: (no files)
```

**Result on Monday**:
```
Monday:
  ## 📤 Carried Forward from Previous Days
  
  ### Incomplete Tasks
  - [ ] Call investor     ← Only once
  - [ ] Update website    ← Only once
  - [ ] Send invoices
  - [ ] Review metrics
```

### Example 3: Time Blocks Excluded

**Setup**:
```
Friday:
  Morning (6:00 - 12:00):
    - [ ] 9am stand-up          ← Time block (excluded)
    - [ ] 10am client call      ← Time block (excluded)
  
  Afternoon (12:00 - 18:00):
    - [ ] 2pm team sync         ← Time block (excluded)
  
  Tasks:
    - [ ] Finish proposal       ← General task (included)
    - [ ] Review PR #234        ← General task (included)

Saturday-Sunday: (no files)
```

**Result on Monday**:
```
Monday:
  ## 📤 Carried Forward from Previous Days
  
  ### Incomplete Tasks
  - [ ] Finish proposal
  - [ ] Review PR #234
  
  (Time block meetings NOT carried forward)
```

---

## Migration from v1.1 / v2.1

### No Action Required!

This is a **backward-compatible update**:
- ✅ Existing files work as-is
- ✅ No settings changes needed
- ✅ No data migration required
- ✅ Simply update and restart

### What Changes?

**Old behavior**:
- Checked only yesterday
- If yesterday didn't exist, no carry forward

**New behavior**:
- Checks up to 14 days back
- Aggregates all incomplete tasks
- Removes duplicates automatically

---

## FAQ

### Q: What if I have 20+ days of backlog?
**A**: Only the last 14 days are checked. Tasks older than 14 days won't be carried forward automatically.

### Q: Can I change the 14-day limit?
**A**: Not currently. The 14-day window is hard-coded as a reasonable balance between coverage and performance.

### Q: What counts as a "duplicate"?
**A**: Tasks must match **exactly** (including spacing and capitalization) to be considered duplicates.

### Q: Do completed tasks carry forward?
**A**: No, only incomplete tasks (`- [ ]`) are carried forward. Completed tasks (`- [x]`) stay in their original day.

### Q: What about brain dump items?
**A**: Brain dump items work the same way - they're aggregated from all skipped days and duplicates are removed.

### Q: Does this affect time block tasks?
**A**: No, time block tasks are still excluded from carry forward (same as before).

### Q: Will this slow down the plugin?
**A**: No, the plugin only reads files that exist and stops after 14 days. Performance impact is minimal.

### Q: What if I manually carried tasks forward already?
**A**: If you manually copied tasks to today's file, and those tasks also exist in previous days, only one copy will appear (duplicates are removed).

---

## Upgrade Instructions

### TimeBox Daily (v1.1 → v1.2)

1. Download `timebox-plugin-v1.2.zip`
2. Extract to: `.obsidian/plugins/timebox-daily/`
3. Run: `npm install && npm run build`
4. Restart Obsidian
5. Done! Feature activates automatically

### KTimeBox (v2.1 → v2.2)

1. Download `ktimebox-v2.2.zip`
2. Extract to: `.obsidian/plugins/ktimebox/`
3. Run: `npm install && npm run build`
4. Restart Obsidian
5. Done! Feature activates automatically

---

## Summary

### What's New
✅ 14-day lookback for incomplete tasks
✅ Aggregate tasks from all skipped days
✅ Automatic duplicate removal
✅ Same behavior for brain dump items

### What's the Same
✅ Time block exclusion still works
✅ Settings remain unchanged
✅ File format stays the same
✅ Backward compatible

### Why This Matters
📅 No more lost tasks after weekends
🏖️ Vacation-friendly task management
🤒 Handles sick days gracefully
🎯 Keeps you focused on what matters

---

**Version**: 1.2.0 / 2.2.0
**Feature**: Multi-Day Carry Forward with Duplicate Detection
**Impact**: Handles gaps of up to 14 days seamlessly
