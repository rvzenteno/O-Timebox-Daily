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
                title: 'Collapsible Project Cards',
                desc: 'Click any project header in the Projects Dashboard side panel to collapse or expand project tasks and focus on one project at a time.'
            },
            {
                icon: '🌿',
                title: 'Nested Subtasks & Controls',
                desc: 'Full nested subtask support with expand/collapse chevron toggles, completion count badges (e.g. 1/3), and a quick "+ Add Subtask" button.'
            },
            {
                icon: '🎯',
                title: '6-Dot Drag & Drop Reordering',
                desc: 'Reorder tasks in project cards with smooth 6-dot drag handles, or use editor keyboard shortcuts ("Move task line up / down").'
            },
            {
                icon: '📦',
                title: 'Collapsible Project Task Callouts',
                desc: 'Carried-forward tasks linked to projects are automatically grouped into native collapsible callouts (> [!todo]-), closed by default to avoid clutter.'
            },
            {
                icon: '🧹',
                title: 'Note Task Cleaner Command',
                desc: 'Right-click inside any daily note or use the Command Palette ("Group active note tasks into collapsible project callouts") to clean up stray text and group project tasks.'
            },
            {
                icon: '◀▶',
                title: 'Navigation Link Fix',
                desc: 'Clicking "◀ Yesterday | Tomorrow ▶" links at the top of any daily note now opens or initializes yesterday\'s or tomorrow\'s note instantly.'
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
