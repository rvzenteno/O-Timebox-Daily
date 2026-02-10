# Multi-Day Carry Forward - Visual Guide

## 🎯 The Problem

```
┌─────────────────────────────────────────────────────────┐
│  OLD BEHAVIOR (v1.1 / v2.1)                            │
├─────────────────────────────────────────────────────────┤
│                                                          │
│  Friday:     [ ] Task A                                 │
│              [ ] Task B                                 │
│              [ ] Task C                                 │
│                 ⬇️                                       │
│  Saturday:   (no file) ❌                               │
│                 ⬇️                                       │
│  Sunday:     (no file) ❌                               │
│                 ⬇️                                       │
│  Monday:     (empty - no tasks carried!) ❌             │
│                                                          │
│  Result: Tasks from Friday are LOST                     │
│                                                          │
└─────────────────────────────────────────────────────────┘
```

## ✅ The Solution

```
┌─────────────────────────────────────────────────────────┐
│  NEW BEHAVIOR (v1.2 / v2.2)                            │
├─────────────────────────────────────────────────────────┤
│                                                          │
│  Friday:     [ ] Task A                                 │
│              [ ] Task B                                 │
│              [ ] Task C                                 │
│                 ⬆️                                       │
│  Saturday:   (no file) ⬆️ Plugin searches backwards     │
│                 ⬆️                                       │
│  Sunday:     (no file) ⬆️ Keeps searching...            │
│                 ⬆️                                       │
│  Monday:     ✅ Finds Friday!                           │
│              [ ] Task A  ← Carried forward              │
│              [ ] Task B  ← Carried forward              │
│              [ ] Task C  ← Carried forward              │
│                                                          │
│  Result: All incomplete tasks from Friday appear! ✅    │
│                                                          │
└─────────────────────────────────────────────────────────┘
```

---

## 📊 How It Searches

### Search Window: 14 Days

```
TODAY (Monday Jan 27)
    ⬇️ Check Day -1 (Sunday)
    ⬇️ Check Day -2 (Saturday)
    ⬇️ Check Day -3 (Friday) ✅ Found tasks!
    ⬇️ Check Day -4 (Thursday)
    ⬇️ Check Day -5 (Wednesday)
    ⬇️ ... continues up to Day -14
    ❌ Stops at Day -15

Aggregates ALL tasks found from Days -1 through -14
```

---

## 🔄 Aggregating Multiple Days

### Example: Tasks Across 3 Days

```
┌─────────────────────────────────────────────────────────┐
│  Wednesday Jan 22                                        │
├─────────────────────────────────────────────────────────┤
│  [ ] Review contract                                    │
│  [ ] Update website                                     │
└─────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────┐
│  Thursday Jan 23                                         │
├─────────────────────────────────────────────────────────┤
│  [ ] Update website      ← DUPLICATE                    │
│  [ ] Call investor                                      │
│  [ ] Send invoices                                      │
└─────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────┐
│  Friday Jan 24                                           │
├─────────────────────────────────────────────────────────┤
│  [ ] Call investor       ← DUPLICATE                    │
│  [ ] Review metrics                                     │
└─────────────────────────────────────────────────────────┘

         ⬇️ PLUGIN AGGREGATES ⬇️

┌─────────────────────────────────────────────────────────┐
│  Monday Jan 27                                           │
├─────────────────────────────────────────────────────────┤
│  ## 📤 Carried Forward from Previous Days              │
│                                                          │
│  ### Incomplete Tasks                                   │
│  - [ ] Review contract                                  │
│  - [ ] Update website      ← Only once!                │
│  - [ ] Call investor       ← Only once!                │
│  - [ ] Send invoices                                    │
│  - [ ] Review metrics                                   │
│                                                          │
│  Total: 5 unique tasks (2 duplicates removed)          │
└─────────────────────────────────────────────────────────┘
```

---

## 🚫 Time Blocks Still Excluded

```
┌─────────────────────────────────────────────────────────┐
│  Friday Jan 24                                           │
├─────────────────────────────────────────────────────────┤
│                                                          │
│  ### ⏰ Morning (6:00 - 12:00)                          │
│  - [ ] 8:20am - LDC meeting     ← Time block           │
│  - [ ] 10am - Client call       ← Time block           │
│                                                          │
│  ### ⏰ Afternoon (12:00 - 18:00)                       │
│  - [ ] 2pm - Team sync          ← Time block           │
│  - [ ] 4pm - Review session     ← Time block           │
│                                                          │
│  ### 📝 Tasks                                           │
│  - [ ] Finish proposal          ← General task ✅      │
│  - [ ] Review PR #234           ← General task ✅      │
│                                                          │
│  ### 🧠 Brain Dump                                      │
│  - Research competitors         ← Brain dump ✅        │
│                                                          │
└─────────────────────────────────────────────────────────┘

         ⬇️ PLUGIN FILTERS ⬇️

┌─────────────────────────────────────────────────────────┐
│  Monday Jan 27                                           │
├─────────────────────────────────────────────────────────┤
│                                                          │
│  ## 📤 Carried Forward from Previous Days              │
│                                                          │
│  ### Incomplete Tasks                                   │
│  - [ ] Finish proposal          ✅ Carried             │
│  - [ ] Review PR #234           ✅ Carried             │
│                                                          │
│  ### Brain Dump Items                                   │
│  - Research competitors         ✅ Carried             │
│                                                          │
│  ❌ Time block tasks NOT carried forward!              │
│  (They were specific to Friday's schedule)             │
│                                                          │
└─────────────────────────────────────────────────────────┘
```

---

## 📅 Real-World Scenarios

### Scenario 1: Weekend Gap (2 Days)

```
🗓️  Timeline

Fri ─────── (work ends)
│
Sat ─────── (no file)
│
Sun ─────── (no file)
│
Mon ─────── (work starts)

✅ Result: Friday → Monday (2-day gap)
   All Friday tasks appear on Monday
```

### Scenario 2: Long Weekend (3 Days)

```
🗓️  Timeline

Thu ─────── (work ends)
│
Fri ─────── (holiday)
│
Sat ─────── (weekend)
│
Sun ─────── (weekend)
│
Mon ─────── (work starts)

✅ Result: Thursday → Monday (3-day gap)
   All Thursday tasks appear on Monday
```

### Scenario 3: Week Vacation (7 Days)

```
🗓️  Timeline

Fri Jan 17 ─────── (work ends)
│
Sat-Sun    ─────── (weekend)
│
Mon-Fri    ─────── (vacation)
│
Sat-Sun    ─────── (weekend)
│
Mon Jan 27 ─────── (work starts)

✅ Result: Jan 17 → Jan 27 (10-day gap)
   All tasks from Jan 17 appear on Jan 27
```

### Scenario 4: Extended Break (14+ Days)

```
🗓️  Timeline

Thu Jan 9  ─────── (work ends)
│
... 14 days ...
│
Mon Jan 27 ─────── (work starts)

⚠️  Result: Searches back 14 days
   - Jan 13-27: Checked ✅
   - Jan 9-12:  Not checked ❌ (beyond 14 days)
   
   Tasks from Jan 13+ appear
   Tasks from Jan 9-12 do not appear
```

---

## 🔍 Duplicate Detection Logic

### How Duplicates Are Found

```
Task 1: "- [ ] Call investor"
Task 2: "- [ ] Call investor"
         ↓
    EXACT MATCH = DUPLICATE ✅

Task 1: "- [ ] Call investor"
Task 2: "- [ ] call investor"
         ↓
    Case different = NOT duplicate ❌

Task 1: "- [ ] Call investor"
Task 2: "- [ ]  Call investor"  (extra space)
         ↓
    Spacing different = NOT duplicate ❌

Task 1: "- [ ] Call investor John"
Task 2: "- [ ] Call investor"
         ↓
    Content different = NOT duplicate ❌
```

### Best Practices for Task Naming

✅ **Good** (consistent):
```
- [ ] Call investor
- [ ] Call investor
- [ ] Call investor
→ All detected as duplicates
```

❌ **Problematic** (inconsistent):
```
- [ ] Call investor
- [ ] call investor
- [ ] Call Investor
→ Treated as 3 different tasks
```

---

## ⚡ Performance

### Efficient Search

```
Plugin checks:
✅ Only files that exist
✅ Only up to 14 days
✅ Stops when 14 days reached

Plugin does NOT:
❌ Scan entire vault
❌ Check future dates
❌ Search beyond 14 days
❌ Re-check same file multiple times
```

### Time Complexity

```
Best case:  Yesterday exists → 1 file read
Worst case: 14 days back → 14 file reads max
Average:    Weekend gap → 3-4 file reads

Impact: Minimal (< 100ms even for 14 days)
```

---

## 📋 Quick Reference

| Feature | Before (v1.1) | After (v1.2) |
|---------|---------------|--------------|
| **Search range** | 1 day (yesterday only) | 14 days |
| **Aggregate multiple days** | ❌ No | ✅ Yes |
| **Duplicate detection** | N/A | ✅ Yes |
| **Time block exclusion** | ✅ Yes | ✅ Yes |
| **Performance** | Fast | Fast |
| **Settings required** | None | None |

---

## 💡 Tips for Best Results

### 1. Consistent Task Naming
Use the same format across days:
```
✅ "- [ ] Call investor"  (every time)
❌ "- [ ] call investor"  (lowercase)
❌ "- [ ] Call Investor"  (capitalized)
```

### 2. Clear Task Descriptions
```
✅ "- [ ] Review Q4 financial reports"
✅ "- [ ] Call John re: contract"
❌ "- [ ] Follow up"  (too vague)
❌ "- [ ] That thing"  (unclear)
```

### 3. Regular Check-ins
Even if you don't work, open Obsidian once a week to:
- Review carried forward tasks
- Archive old tasks if needed
- Keep the 14-day window fresh

### 4. Use Brain Dump Section
For ongoing thoughts that span multiple days:
```
Friday Brain Dump:
- Research competitor pricing
- Draft Q1 roadmap ideas

Monday:
→ Brain dump items carry forward too!
```

---

## 🎉 Summary

### What This Solves
✅ Weekend gaps (2 days)
✅ Long weekends (3-4 days)
✅ Vacations (up to 14 days)
✅ Sick days
✅ Any work interruption

### How It Works
1. Searches backwards up to 14 days
2. Finds all incomplete tasks
3. Removes duplicates
4. Aggregates into today's file
5. Excludes time block tasks

### Why It Matters
🎯 Never lose track of important tasks
📅 Seamlessly handle work interruptions
🧘 Return from breaks stress-free
💪 Stay productive across gaps

---

**Version**: 1.2.0 (TimeBox Daily) / 2.2.0 (KTimeBox)
**Feature**: Multi-Day Carry Forward
**Benefit**: Up to 14 days of smart task aggregation
