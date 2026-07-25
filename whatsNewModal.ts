import { App, Modal } from 'obsidian';

export class WhatsNewModal extends Modal {
    version: string;

    constructor(app: App, version: string) {
        super(app);
        this.version = version;
    }

    onOpen() {
        const { contentEl } = this;
        contentEl.empty();
        contentEl.addClass('timebox-whats-new-modal');

        // Header
        const headerContainer = contentEl.createDiv({ cls: 'timebox-modal-header' });
        headerContainer.createEl('h2', { text: `🎉 What's New in TimeBox Daily v${this.version}` });
        headerContainer.createEl('p', {
            cls: 'timebox-modal-subtitle',
            text: 'Thank you for updating! Here are the latest features and improvements in your timeboxing workspace.'
        });

        // Feature Highlights Container
        const featuresContainer = contentEl.createDiv({ cls: 'timebox-modal-features' });

        const features = [
            {
                icon: '🗂',
                title: 'Multi-Project Tracking',
                desc: 'Manage dedicated project notes inside `TimeBox/Projects/` with progress bars, task counts, and backlogs.'
            },
            {
                icon: '📊',
                title: 'Projects Sidebar Dashboard',
                desc: 'Interactive right-sidebar panel showing visual progress bars and instant task checkboxes across all projects.'
            },
            {
                icon: '🔄',
                title: 'Bi-Directional Task Syncing',
                desc: 'Checking off tasks (`- [x]`) in your daily notes, project notes, or sidebar dashboard automatically updates everywhere.'
            },
            {
                icon: '🔗',
                title: 'Automatic [[Project]] Link Parsing',
                desc: 'Type `- [ ] Task [[ProjectName]]` in any daily note to automatically link and track tasks under that project.'
            },
            {
                icon: '👁️',
                title: 'Hide/Show Completed Tasks',
                desc: 'Toggle finished tasks on or off with a single click (`👁`) in your dashboard header or settings.'
            },
            {
                icon: '🚀',
                title: 'Auto-Open on Startup',
                desc: 'Automatically open today\'s TimeBox note and Projects Dashboard whenever Obsidian launches.'
            }
        ];

        for (const feat of features) {
            const item = featuresContainer.createDiv({ cls: 'timebox-feature-item' });
            item.createDiv({ cls: 'timebox-feature-icon', text: feat.icon });
            const body = item.createDiv({ cls: 'timebox-feature-body' });
            body.createEl('h4', { text: feat.title });
            body.createEl('p', { text: feat.desc });
        }

        // Support & Contribution Section
        const supportSection = contentEl.createDiv({ cls: 'timebox-modal-support' });
        supportSection.createEl('h3', { text: '💙 Support & Contribute' });
        supportSection.createEl('p', {
            text: 'TimeBox Daily is open-source and free. If it helps you stay focused and productive, consider supporting future development:'
        });

        const buttonsContainer = supportSection.createDiv({ cls: 'timebox-support-buttons' });

        const paypalBtn = buttonsContainer.createEl('a', {
            cls: 'timebox-support-btn timebox-paypal-btn',
            text: '💳 PayPal',
            href: 'https://paypal.me/VictorZenteno'
        });
        paypalBtn.setAttribute('target', '_blank');

        const coffeeBtn = buttonsContainer.createEl('a', {
            cls: 'timebox-support-btn timebox-coffee-btn',
            text: '☕ Buy Me a Coffee',
            href: 'https://buymeacoffee.com/victorzenteno'
        });
        coffeeBtn.setAttribute('target', '_blank');

        const githubBtn = buttonsContainer.createEl('a', {
            cls: 'timebox-support-btn timebox-github-btn',
            text: '⭐ Star on GitHub',
            href: 'https://github.com/rvzenteno/O-Timebox-Daily'
        });
        githubBtn.setAttribute('target', '_blank');

        // Footer / Close button
        const footerEl = contentEl.createDiv({ cls: 'timebox-modal-footer' });
        const closeBtn = footerEl.createEl('button', {
            cls: 'mod-cta',
            text: 'Got it, let\'s go!'
        });
        closeBtn.addEventListener('click', () => {
            this.close();
        });
    }

    onClose() {
        const { contentEl } = this;
        contentEl.empty();
    }
}
