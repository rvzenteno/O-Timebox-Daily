# TimeBox Manager for Obsidian

A comprehensive time management plugin for Obsidian that implements the TimeBox methodology. Stay focused, productive, and organized by managing your time in structured blocks with automatic task rollover and daily planning.

## 🎯 Features

- **Auto-Open on Startup**: Automatically opens today's TimeBox when you launch Obsidian
- **Daily TimeBox Creation**: Creates structured daily notes with time blocks, tasks, and brain dump sections
- **Smart Task Rollover**: Automatically moves incomplete tasks from previous days to today
- **Brain Dump Tracking**: Keeps track of unprocessed thoughts and ideas across days
- **Customizable Templates**: Fully customizable daily template to match your workflow
- **Calendar Integration**: Date-based file naming for easy navigation and search
- **Quick Access**: Ribbon icon and command palette shortcuts

## 📦 Installation

### Manual Installation

1. Download the latest release files:
   - `main.js`
   - `manifest.json`
   - `styles.css` (if available)

2. Create a folder called `timebox-manager` in your vault's `.obsidian/plugins/` directory

3. Copy the downloaded files into the `timebox-manager` folder

4. Reload Obsidian

5. Enable the plugin in Settings → Community Plugins

### Development Installation

1. Clone this repository into your vault's `.obsidian/plugins/` folder:
   ```bash
   cd /path/to/your/vault/.obsidian/plugins
   git clone https://github.com/yourusername/obsidian-timebox-manager.git timebox-manager
   cd timebox-manager
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Build the plugin:
   ```bash
   npm run build
   ```

4. Reload Obsidian and enable the plugin

## 🚀 Usage

### Getting Started

1. After enabling the plugin, it will automatically create a TimeBox folder in your vault
2. Each time you start Obsidian, today's TimeBox will open automatically
3. Start filling in your time blocks, tasks, and brain dump items

### Daily Workflow

**Morning:**
1. Open Obsidian (today's TimeBox opens automatically)
2. Review rolled-over tasks from yesterday
3. Set your #1 focus for the day
4. Plan your time blocks
5. Add specific tasks

**Throughout the Day:**
- Check off tasks as you complete them
- Add new tasks or thoughts to the Brain Dump section
- Update your time blocks as needed

**End of Day:**
- Move completed tasks to the "Completed Today" section
- Leave incomplete tasks unchecked (they'll rollover tomorrow)
- Reflect on your day in the Notes section

### Commands

Access these from the Command Palette (Ctrl/Cmd + P):

- **Open Today's TimeBox**: Opens or creates today's TimeBox note
- **Rollover Incomplete Tasks**: Manually trigger task rollover from previous day

### Ribbon Icon

Click the calendar-check icon in the left ribbon to quickly open today's TimeBox.

## ⚙️ Settings

### TimeBox Folder
- **Default**: `TimeBox`
- **Description**: Location where all TimeBox notes will be stored
- **Tip**: Use a subfolder like `Daily/TimeBox` for organization

### Auto-open on Startup
- **Default**: Enabled
- **Description**: Automatically opens today's TimeBox when Obsidian launches
- **Use Case**: Perfect for starting your day with intention

### Rollover Incomplete Tasks
- **Default**: Enabled
- **Description**: Automatically moves incomplete tasks and brain dump items from yesterday
- **Note**: Tasks in the "Completed Today" section won't be rolled over

### Template Customization
Customize your daily template to fit your needs. The default template includes:
- Today's Focus (your #1 priority)
- Time Blocks (Morning, Afternoon, Evening)
- Tasks section
- Brain Dump section
- Notes & Reflections
- Completed Today section

**Template Variables:**
- `{{date}}`: Replaced with the current date in "MMMM D, YYYY" format

## 📋 Template Structure

The default template follows the TimeBox methodology:

```markdown
# TimeBox - {{date}}

## 🎯 Today's Focus
<!-- Your #1 priority -->

## ⏰ Time Blocks
### Morning (8:00 AM - 12:00 PM)
- [ ] 

### Afternoon (1:00 PM - 5:00 PM)
- [ ] 

### Evening (6:00 PM - 9:00 PM)
- [ ] 

## 📋 Tasks
- [ ] 

## 🧠 Brain Dump
- 

## 📝 Notes & Reflections

## ✅ Completed Today
```

## 🎨 Customization Tips

### Custom Time Blocks
Adjust time blocks to match your schedule:
```markdown
### Deep Work (6:00 AM - 9:00 AM)
### Meetings (9:00 AM - 12:00 PM)
### Creative Time (1:00 PM - 4:00 PM)
### Admin (4:00 PM - 5:00 PM)
```

### Adding Sections
Add custom sections to your template:
```markdown
## 💡 Ideas
## 🏋️ Health & Wellness
## 📚 Learning
## 🎯 Weekly Goals
```

### Integration with Other Plugins
- **Dataview**: Query your TimeBox notes for analytics
- **Calendar**: Visualize your TimeBox timeline
- **Daily Notes**: Works alongside core Daily Notes plugin
- **Tasks**: Enhanced task management and queries

## 🔧 Development

### Building the Plugin

```bash
# Install dependencies
npm install

# Development build with watch mode
npm run dev

# Production build
npm run build
```

### Project Structure

```
timebox-plugin/
├── main.ts              # Main plugin code
├── manifest.json        # Plugin metadata
├── package.json         # Node dependencies
├── tsconfig.json        # TypeScript configuration
├── esbuild.config.mjs   # Build configuration
├── version-bump.mjs     # Version management
└── versions.json        # Version history
```

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## 🌟 Support This Plugin

If you find TimeBox Daily helpful, please consider supporting its development:

### PayPal
[![Donate with PayPal](https://img.shields.io/badge/Donate-PayPal-blue.svg)](https://www.paypal.com/paypalme/robertozenteno)

**One-time or recurring donations**: [paypal.me/robertozenteno](https://www.paypal.com/paypalme/robertozenteno)

### Cryptocurrency

**USDC (Base Network)**
```
0x8A0109dd87C8FdbE28F8B5E694D4AAbfb8a57F55
```

**USDT (Tron TRC-20)**
```
TYP5T4b6RrD8ESb8fBPN4dwHf4FZYxxx3H
```

### Other Ways to Support
- ⭐ Star this repository
- 🐛 Report bugs and suggest features
- 🔀 Contribute code
- 📢 Share with others who might find it useful

Thank you for your support! Every contribution helps maintain and improve TimeBox Daily. 🙏

---

## 📝 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 🙏 Acknowledgments

- Inspired by the TimeBox time management methodology
- Built for the Obsidian community
- Thanks to all contributors and users

## 📞 Support

- **Issues**: [GitHub Issues](https://github.com/yourusername/obsidian-timebox-manager/issues)
- **Discussions**: [GitHub Discussions](https://github.com/yourusername/obsidian-timebox-manager/discussions)
- **Obsidian Forum**: [Plugin Thread](https://forum.obsidian.md)

## 🗺️ Roadmap

- [ ] Weekly and monthly TimeBox views
- [ ] Statistics and productivity analytics
- [ ] Time tracking integration
- [ ] Templates library
- [ ] Mobile optimization
- [ ] Pomodoro timer integration
- [ ] Task priority system
- [ ] Calendar view for TimeBox notes
- [ ] Export functionality

## 📊 Version History

### 1.0.0 (Current)
- Initial release
- Auto-open on startup
- Task rollover functionality
- Brain dump tracking
- Customizable templates
- Settings panel

---

**Made with ❤️ for productivity enthusiasts**

If you find this plugin helpful, consider giving it a star on GitHub!
