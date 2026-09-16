---
title: Commercial Facility Buildout & Signal Infrastructure
projectStartDate: 2026-09-14
deadline: 2026-12-15
author: Roberto Zenteno
client: City Infrastructure Dept
tags:
  - projects
  - construction
  - commercial
calendars:
  - id: standard
    name: Standard 5-day Municipal
    workingDays:
      - 1
      - 2
      - 3
      - 4
      - 5
    hoursPerDay: 8
    holidays:
      - 2026-10-12
resources:
  - id: alice-eng
    name: Alice Lead Engineer
    type: Work
    maxUnits: 100%
    workingHoursPerDay: 8
    ratePerHour: 110
    notes: PE Certified Lead Engineer
  - id: bob-tech
    name: Bob Field Tech (Part-Time)
    type: Work
    maxUnits: 100%
    workingHoursPerDay: 4
    ratePerHour: 65
    notes: Part-time field electronics technician
  - id: carol-insp
    name: Carol Safety Inspector
    type: Work
    maxUnits: 100%
    workingHoursPerDay: 8
    ratePerHour: 95
    notes: Municipal QA/QC Inspector
  - id: dave-contractor
    name: Dave Civil Contractor
    type: Work
    maxUnits: 100%
    workingHoursPerDay: 8
    ratePerHour: 85
    notes: Heavy equipment operator & site civil
baselines:
  "0":
    name: Baseline 0 (Initial Approval)
    capturedAt: 2026-09-10T14:00:00.000Z
    totalWorkHours: 1240
    totalCost: 115600
    tasks:
      "1.1.1.1.1":
        start: 2026-09-14
        finish: 2026-09-15
        durationDays: 2
        workHours: 16
        cost: 1760
      "1.1.1.1.2":
        start: 2026-09-16
        finish: 2026-09-18
        durationDays: 3
        workHours: 24
        cost: 2640
---

# Commercial Facility Buildout & Signal Infrastructure

Comprehensive municipal signal and commercial equipment structure buildout contract. Reference specifications from [[City Planning Dept]] and [[Safety Manual]].

> [!important] Environmental Compliance Notice
> All excavation in Sector 4 must adhere strictly to environmental groundwater runoff controls outlined in [[Environmental Protection Protocol]].

- Review vendor submittals prior to mobilization
- Notify utility operators 48 hours in advance via 811 call center

## Work Breakdown Structure & Schedule

- [x] 1. Project Initiation & Permitting 🛫 2026-09-14 📅 2026-09-25 ⏳ 10d
  - [x] 1.1 Architectural & Engineering Specs 🛫 2026-09-14 📅 2026-09-22 ⏳ 7d
    - [x] 1.1.1 Structural Foundation Design 🛫 2026-09-14 📅 2026-09-18 ⏳ 5d
      - [x] 1.1.1.1 Geotechnical Soil Borings Analysis 🛫 2026-09-14 📅 2026-09-18 ⏳ 5d
        - [x] 1.1.1.1.1 Sub-surface Core Sample Extraction 🛫 2026-09-14 📅 2026-09-15 ⏳ 2d @dave-contractor [costCode::CIV-101]
        - [x] 1.1.1.1.2 Laboratory Shear & Bearing Capacity Tests 🛫 2026-09-16 📅 2026-09-18 ⏳ 3d dependsOn:: 1.1.1.1.1FS @alice-eng [priority:: high]
      - [x] 1.1.1.2 Foundation Rebar & Footing Calculations 🛫 2026-09-21 📅 2026-09-22 ⏳ 2d dependsOn:: 1.1.1.1.2FS @alice-eng
  - [x] 1.2 Electrical Load Calculations & Conduit Sizing 🛫 2026-09-15 📅 2026-09-21 ⏳ 5d dependsOn:: 1.1.1.1.1SS+1d @bob-tech
  - [x] 1.3 Environmental Impact Assessment Review 🛫 2026-09-16 📅 2026-09-22 ⏳ 5d dependsOn:: 1.2SS+1d @carol-insp
  - [x] 1.4 Permit Package Approval Milestone 🛫 2026-09-25 📅 2026-09-25 ⏳ 0d dependsOn:: 1.1FF, 1.3FF #milestone
- [ ] 2. Civil Site Preparation & Earthwork 🛫 2026-09-28 📅 2026-10-16 ⏳ 14d dependsOn:: 1.4FS+1d
  - [x] 2.1 Site Clearing & Tree Protection Barrier 🛫 2026-09-28 📅 2026-09-29 ⏳ 2d @dave-contractor
  - [ ] 2.2 Excavation & Utility Trenching 🛫 2026-09-30 📅 2026-10-09 ⏳ 8d dependsOn:: 2.1FS
    - [ ] 2.2.1 Deep Foundation Trenching 🛫 2026-09-30 📅 2026-10-06 ⏳ 5d @dave-contractor [%:: 75]
    - [ ] 2.2.2 Secondary Conduit Trenching 🛫 2026-10-05 📅 2026-10-07 ⏳ 3d dependsOn:: 2.2.1SS+3d @bob-tech <!-- Intentional Bob parallel assignment -->
    - [ ] 2.2.3 Sensor Conduit Handhole Excavation 🛫 2026-10-05 📅 2026-10-07 ⏳ 3d @bob-tech <!-- Concurrent Bob conflict on 2026-10-05 -->
    - [ ] 2.2.4 Trench Bedding Sand Compaction 🛫 2026-10-08 📅 2026-10-09 ⏳ 2d dependsOn:: 2.2.2FF, 2.2.3FF @dave-contractor
  - [ ] 2.3 Concrete Forms & Rebar Placement 🛫 2026-10-13 📅 2026-10-15 ⏳ 3d dependsOn:: 2.2FS <!-- Skips holiday 2026-10-12 -->
    - [ ] 2.3.1 Outer Formwork Assembly 🛫 2026-10-13 📅 2026-10-14 ⏳ 2d @dave-contractor
    - [ ] 2.3.2 Rebar Cage Tying & Grounding Grid 🛫 2026-10-14 📅 2026-10-15 ⏳ 2d dependsOn:: 2.3.1SS+1d @alice-eng
  - [ ] 2.4 Pre-Pour Structural Inspection 🛫 2026-10-16 📅 2026-10-16 ⏳ 1d dependsOn:: 2.3FF @carol-insp [priority:: high]
- [ ] 3. Structural Signal Pole & Enclosure Erection 🛫 2026-10-19 📅 2026-11-06 ⏳ 15d dependsOn:: 2.4FS+1d
  - [ ] 3.1 High-Strength Concrete Pour 🛫 2026-10-19 📅 2026-10-20 ⏳ 2d @dave-contractor
  - [ ] 3.2 Concrete Curing Period 🛫 2026-10-21 📅 2026-10-27 ⏳ 5d dependsOn:: 3.1FS [constraint:: snet 2026-10-21]
  - [ ] 3.3 Anchor Bolt Pull Testing 🛫 2026-10-28 📅 2026-10-28 ⏳ 1d dependsOn:: 3.2FS @carol-insp
  - [ ] 3.4 Mast Pole Crane Delivery & Rigging 🛫 2026-10-29 📅 2026-10-30 ⏳ 2d dependsOn:: 3.3FS @dave-contractor
  - [ ] 3.5 Mast Pole Hoisting & Alignment 🛫 2026-11-02 📅 2026-11-03 ⏳ 2d dependsOn:: 3.4FS @dave-contractor, @alice-eng
  - [ ] 3.6 Plumb Alignment & Bolt Torquing 🛫 2026-11-04 📅 2026-11-05 ⏳ 2d dependsOn:: 3.5FS @alice-eng
  - [ ] 3.7 Equipment Housing Cabinet Bolting 🛫 2026-11-05 📅 2026-11-06 ⏳ 2d dependsOn:: 3.6SS+1d @bob-tech
- [ ] 4. Electrical, Optical & Sensor Wiring 🛫 2026-11-06 📅 2026-11-20 ⏳ 11d dependsOn:: 3.7SS+1d
  - [ ] 4.1 Underground Power Feeder Pulling 🛫 2026-11-06 📅 2026-11-10 ⏳ 3d @bob-tech
  - [ ] 4.2 Fiber Optic Backbone Splicing 🛫 2026-11-11 📅 2026-11-13 ⏳ 3d dependsOn:: 4.1FS @alice-eng
  - [ ] 4.3 Signal Head Bracket Mounting 🛫 2026-11-12 📅 2026-11-16 ⏳ 3d dependsOn:: 4.2SS+1d @bob-tech
  - [ ] 4.4 Radar Vehicle Detectors Installation 🛫 2026-11-16 📅 2026-11-18 ⏳ 3d dependsOn:: 4.3FS @bob-tech
  - [ ] 4.5 Pedestrian Pushbutton Audio Units 🛫 2026-11-17 📅 2026-11-19 ⏳ 3d dependsOn:: 4.4SS+1d @bob-tech
  - [ ] 4.6 Terminal Cabinet Internal Termination 🛫 2026-11-19 📅 2026-11-20 ⏳ 2d dependsOn:: 4.2FF, 4.5FF @alice-eng
- [ ] 5. System Commissioning, QA Testing & Handover 🛫 2026-11-23 📅 2026-12-08 ⏳ 12d dependsOn:: 4.6FS+1d
  - [ ] 5.1 Power Service Activation & Meter Drop 🛫 2026-11-23 📅 2026-11-24 ⏳ 2d @carol-insp
  - [ ] 5.2 Signal Controller Firmware Flashing 🛫 2026-11-25 📅 2026-11-26 ⏳ 2d dependsOn:: 5.1FS @alice-eng
  - [ ] 5.3 Optical Detector Calibration Loop 🛫 2026-11-27 📅 2026-12-01 ⏳ 3d dependsOn:: 5.2FS @bob-tech
  - [ ] 5.4 72-Hour Continuous Burn-in & Field Audit 🛫 2026-12-02 📅 2026-12-04 ⏳ 3d dependsOn:: 5.3FS @carol-insp
  - [ ] 5.5 Final Municipal Certificate of Occupancy Issued 🛫 2026-12-08 📅 2026-12-08 ⏳ 0d dependsOn:: 5.4FS+1d #milestone
- [ ] 6. Supplementary Site Restoration & Landscaping 🛫 2026-11-16 📅 2026-12-04 ⏳ 15d dependsOn:: 3.5FS+9d
  - [ ] 6.1 Topsoil Backfill & Grading 🛫 2026-11-16 📅 2026-11-18 ⏳ 3d @dave-contractor
  - [ ] 6.2 Asphalt Surface Patching 🛫 2026-11-19 📅 2026-11-20 ⏳ 2d dependsOn:: 6.1FS @dave-contractor
  - [ ] 6.3 Concrete Sidewalk ADA Ramp Pour 🛫 2026-11-23 📅 2026-11-25 ⏳ 3d dependsOn:: 6.2FS @dave-contractor
  - [ ] 6.4 Permanent Thermoplastic Crosswalk Striping 🛫 2026-11-26 📅 2026-11-30 ⏳ 3d dependsOn:: 6.3FS @dave-contractor
  - [ ] 6.5 Final Punchlist Walkthrough & Signoff 🛫 2026-12-01 📅 2026-12-04 ⏳ 4d dependsOn:: 6.4FF, 5.4FF @carol-insp, @alice-eng

<!-- Final contractor signoff block -->
<!-- Inspection contact: municipal-eng@citygov.org -->
- Maintenance warranty period begins immediately upon Milestone 5.5 signoff.
