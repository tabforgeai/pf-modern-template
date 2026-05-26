'use strict';

const PFTemplate = (() => {

    // ─── Theme ────────────────────────────────────────────

    const THEMES = ['light', 'dark', 'dim'];

    function setTheme(name) {
        document.documentElement.dataset.theme = name;
        localStorage.setItem('pft-theme', name);
        // Phase 2: persist to server-side GuestPreferencesBean via Ajax
    }

    function cycleTheme() {
        const current = document.documentElement.dataset.theme || 'light';
        const idx = THEMES.indexOf(current);
        setTheme(THEMES[(idx + 1) % THEMES.length]);
    }

    // Called immediately from inline script in <head> to prevent theme flash
    function restoreTheme() {
        const saved = localStorage.getItem('pft-theme');
        if (saved && THEMES.includes(saved)) {
            document.documentElement.dataset.theme = saved;
        }
    }

    // ─── Topbar dropdowns ─────────────────────────────────

    function toggleDropdown(itemId) {
        const item = document.getElementById(itemId);
        if (!item) return;
        const isOpen = item.classList.contains('dropdown-open');
        closeAllDropdowns();
        if (!isOpen) item.classList.add('dropdown-open');
    }

    function closeAllDropdowns() {
        document.querySelectorAll('.topbar-item.dropdown-open')
                .forEach(el => el.classList.remove('dropdown-open'));
    }

    // ─── Menu ─────────────────────────────────────────────

    function toggleMenu() {
        document.querySelector('.layout-wrapper')?.classList.toggle('layout-menu-active');
    }

    // ─── Menu layout mode ─────────────────────────────────

    const MENU_LAYOUTS = ['static', 'overlay', 'slim', 'horizontal'];

    function setMenuLayout(mode) {
        if (!MENU_LAYOUTS.includes(mode)) return;
        const wrapper = document.querySelector('.layout-wrapper');
        if (!wrapper) return;
        MENU_LAYOUTS.forEach(m => wrapper.classList.remove('layout-menu-' + m));
        wrapper.classList.remove('layout-menu-active'); // reset open state on mode change
        if (mode !== 'static') {
            wrapper.classList.add('layout-menu-' + mode);
        }
        localStorage.setItem('pft-menu-layout', mode);
    }

    function restoreMenuLayout() {
        const saved = localStorage.getItem('pft-menu-layout');
        if (saved && MENU_LAYOUTS.includes(saved)) setMenuLayout(saved);
    }

    // ─── Menu theme ───────────────────────────────────────

    function setMenuTheme(theme) {
        document.querySelector('.layout-wrapper')
                ?.classList.toggle('layout-menu-light', theme === 'light');
        localStorage.setItem('pft-menu-theme', theme);
    }

    function restoreMenuTheme() {
        const saved = localStorage.getItem('pft-menu-theme');
        if (saved) setMenuTheme(saved);
    }

    // ─── Input style (outlined / filled) ──────────────────

    function setInputStyle(style) {
        document.body.classList.toggle('ui-input-filled', style === 'filled');
        localStorage.setItem('pft-input-style', style);
    }

    function restoreInputStyle() {
        const saved = localStorage.getItem('pft-input-style');
        if (saved) setInputStyle(saved);
    }

    // ─── RTL ──────────────────────────────────────────────

    function setRtl(value) {
        document.documentElement.dir = value ? 'rtl' : 'ltr';
        document.querySelector('.layout-wrapper')?.classList.toggle('layout-rtl', !!value);
        document.getElementById('config-panel')?.classList.toggle('layout-rtl', !!value);
        localStorage.setItem('pft-rtl', value ? '1' : '0');
    }

    function restoreRtl() {
        const saved = localStorage.getItem('pft-rtl');
        if (saved === '1') setRtl(true);
    }

    // ─── AI Panel ─────────────────────────────────────────

    function toggleAiPanel() {
        document.querySelector('.layout-wrapper')?.classList.toggle('ai-panel-open');
    }

    function setAiStatus(status) {
        const wrapper = document.querySelector('.layout-wrapper');
        if (!wrapper) return;
        wrapper.classList.remove('ai-idle', 'ai-thinking', 'ai-error');
        wrapper.classList.add(`ai-${status}`);

        const text = document.getElementById('ai-statusbar-text');
        if (text) {
            const labels = { idle: 'AI ready', thinking: 'AI thinking…', error: 'AI error' };
            text.textContent = labels[status] ?? status;
        }
    }

    // ─── AI Panel — conversation UI ───────────────────────

    const aiPanel = {
        messagesEl: null,
        inputEl: null,
        sendBtn: null,
        emptyEl: null,
        voiceBtn: null,
        isStreaming: false,
        lastUserText: '',

        init() {
            this.messagesEl = document.getElementById('ai-panel-messages');
            this.inputEl    = document.getElementById('ai-panel-input');
            this.sendBtn    = document.getElementById('ai-panel-send-btn');
            this.emptyEl    = document.getElementById('ai-panel-empty');
            this.voiceBtn   = document.getElementById('ai-panel-voice-btn');
            if (!this.inputEl) return;

            this.inputEl.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    this.send();
                }
            });

            this.inputEl.addEventListener('input', () => {
                this.inputEl.style.height = 'auto';
                this.inputEl.style.height = Math.min(this.inputEl.scrollHeight, 128) + 'px';
            });
            this._initVoice();
        },

        send() {
            if (this.isStreaming || !this.inputEl) return;
            const text = this.inputEl.value.trim();
            if (!text) return;

            this.lastUserText = text;
            this.inputEl.value = '';
            this.inputEl.style.height = 'auto';
            this._hideEmpty();
            this._appendUser(text);
            this._stream(this._demoResponse(text));
        },

        _appendUser(text) {
            const el = document.createElement('div');
            el.className = 'ai-message ai-message-user';
            el.innerHTML = `<span class="ai-message-label">You</span><div class="ai-message-bubble">${this._esc(text)}</div>`;
            this.messagesEl.appendChild(el);
            this._scrollBottom();
        },

        _stream(text) {
            this.isStreaming = true;
            if (this.sendBtn) this.sendBtn.disabled = true;
            setAiStatus('thinking');

            const wrapper = document.createElement('div');
            wrapper.className = 'ai-message ai-message-assistant';
            wrapper.innerHTML = `<span class="ai-message-label">AI Assistant</span><div class="ai-stream-bubble"><span class="ai-stream-text"></span><span class="ai-stream-cursor">▋</span></div>`;
            this.messagesEl.appendChild(wrapper);
            this._scrollBottom();

            const textEl = wrapper.querySelector('.ai-stream-text');
            const cursor = wrapper.querySelector('.ai-stream-cursor');
            let i = 0;

            const tick = setInterval(() => {
                if (i < text.length) {
                    textEl.textContent += text[i++];
                    this._scrollBottom();
                } else {
                    clearInterval(tick);
                    cursor.remove();
                    this.isStreaming = false;
                    if (this.sendBtn) this.sendBtn.disabled = false;
                    setAiStatus('idle');
                    this._finalizeAssistantMsg(wrapper, text);
                }
            }, 18);
        },

        _finalizeAssistantMsg(wrapper, rawText) {
            const streamBubble = wrapper.querySelector('.ai-stream-bubble');
            if (streamBubble) {
                const bubble = document.createElement('div');
                bubble.className = 'ai-message-bubble';
                bubble.innerHTML = window.marked ? window.marked.parse(rawText) : this._esc(rawText);
                streamBubble.replaceWith(bubble);
                this._addCopyButtons(bubble);
            }
            this._addRetryBtn(wrapper);
            this._scrollBottom();
        },

        _addCopyButtons(container) {
            container.querySelectorAll('pre').forEach(pre => {
                const btn = document.createElement('button');
                btn.className = 'ai-code-copy-btn';
                btn.textContent = 'Copy';
                btn.addEventListener('click', () => {
                    const code = pre.querySelector('code')?.textContent ?? pre.textContent;
                    navigator.clipboard.writeText(code).then(() => {
                        btn.textContent = 'Copied!';
                        setTimeout(() => { btn.textContent = 'Copy'; }, 2000);
                    });
                });
                pre.appendChild(btn);
            });
        },

        _addRetryBtn(wrapper) {
            const btn = document.createElement('button');
            btn.className = 'ai-retry-btn';
            btn.innerHTML = '<i class="pi pi-refresh"></i> Retry';
            btn.addEventListener('click', () => {
                wrapper.remove();
                this._stream(this._demoResponse(this.lastUserText));
            });
            wrapper.appendChild(btn);
        },

        _initVoice() {
            if (!this.voiceBtn) return;
            const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
            if (!SR) { this.voiceBtn.style.display = 'none'; return; }
            const recognition = new SR();
            recognition.lang = 'en-US';
            recognition.continuous = false;
            recognition.interimResults = false;
            recognition.onresult = (e) => {
                if (this.inputEl) {
                    this.inputEl.value = e.results[0][0].transcript;
                    this.inputEl.dispatchEvent(new Event('input'));
                }
                this.voiceBtn.classList.remove('ai-voice-active');
            };
            recognition.onend = () => this.voiceBtn.classList.remove('ai-voice-active');
            recognition.onerror = () => this.voiceBtn.classList.remove('ai-voice-active');
            this.voiceBtn.addEventListener('click', () => {
                if (this.voiceBtn.classList.contains('ai-voice-active')) {
                    recognition.stop();
                } else {
                    this.voiceBtn.classList.add('ai-voice-active');
                    recognition.start();
                }
            });
        },

        _hideEmpty() {
            if (this.emptyEl) this.emptyEl.style.display = 'none';
        },

        _scrollBottom() {
            if (this.messagesEl) this.messagesEl.scrollTop = this.messagesEl.scrollHeight;
        },

        _esc(str) {
            return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
        },

        _demoResponse(input) {
            const q = input.toLowerCase();
            if (q.includes('theme') || q.includes('dark') || q.includes('light') || q.includes('dim')) {
                return 'You can switch themes using the config panel (gear icon in the topbar), or via the command palette (Ctrl+K → Theme: Dark / Light / Dim). The preference is saved to localStorage so it persists across reloads.';
            }
            if (q.includes('menu') || q.includes('sidebar') || q.includes('navigation') || q.includes('layout')) {
                return 'The sidebar supports four layout modes: Static (always visible), Overlay (slides over content), Slim (icon-only, 64px wide), and Horizontal (top navigation bar). Switch them in the config panel.';
            }
            if (q.includes('command') || q.includes('palette') || q.includes('ctrl')) {
                return 'Press Ctrl+K (or ⌘K on Mac) to open the command palette. You can search pages, switch themes, toggle the AI panel, or open settings — all from the keyboard.';
            }
            if (q.match(/^(hello|hi|hey|pozz|zdravo)/)) {
                return 'Hello! I\'m the AI Assistant built into PF Modern Template. Ask me about themes, menu modes, keyboard shortcuts, or any feature of this template.';
            }
            if (q.includes('code') || q.includes('example') || q.includes('markdown') || q.includes('sample')) {
                return '## Markdown rendering\n\nThis response demonstrates **bold**, *italic*, and `inline code`.\n\n### JavaScript example\n\n```javascript\nfunction greet(name) {\n    return `Hello, ${name}!`;\n}\n\nconsole.log(greet(\'World\'));\n```\n\n### Features\n\n- Markdown parsed via **marked.js**\n- Code blocks have a **Copy** button (hover to reveal)\n- Retry button appears after each response\n\n> Tip: voice input fills the textarea — press Enter to send.';
            }
            return 'This is a simulated streaming response. In a real deployment this panel connects to an LLM via the Anthropic Java SDK or another AI provider. The typewriter animation is implemented in vanilla JS — no framework required.';
        }
    };

    // ─── Command Palette ──────────────────────────────────

    const palette = {
        overlay: null,
        input: null,
        results: null,
        isOpen: false,

        init() {
            this.overlay = document.getElementById('command-palette');
            this.input   = document.getElementById('palette-input');
            this.results = document.getElementById('palette-results');
            if (!this.overlay) return;

            document.addEventListener('keydown', (e) => {
                if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
                    e.preventDefault();
                    this.isOpen ? this.close() : this.open();
                }
                if (e.key === 'Escape' && this.isOpen) this.close();
            });

            // Close on backdrop click
            this.overlay.addEventListener('mousedown', (e) => {
                if (e.target === this.overlay) this.close();
            });

            this.input?.addEventListener('input', () => this.filter(this.input.value));
            this.input?.addEventListener('keydown', (e) => this.navigate(e));
        },

        open() {
            this.isOpen = true;
            this.overlay.classList.add('palette-open');
            this.overlay.setAttribute('aria-hidden', 'false');
            this.render(this.getItems());
            setTimeout(() => this.input?.focus(), 30);
        },

        close() {
            this.isOpen = false;
            this.overlay.classList.remove('palette-open');
            this.overlay.setAttribute('aria-hidden', 'true');
            if (this.input) this.input.value = '';
        },

        // Static item list — Phase 3 will build this dynamically from the menu
        getItems() {
            return [
                { label: 'Dashboard',      icon: 'pi-home',     url: 'index.xhtml' },
                { label: 'Theme: Light',   icon: 'pi-sun',      action: () => setTheme('light') },
                { label: 'Theme: Dark',    icon: 'pi-moon',     action: () => setTheme('dark') },
                { label: 'Theme: Dim',     icon: 'pi-circle',   action: () => setTheme('dim') },
                { label: 'AI Assistant',   icon: 'pi-sparkles', action: () => toggleAiPanel() },
                { label: 'Settings',       icon: 'pi-cog',      action: () => openConfig() },
            ];
        },

        filter(query) {
            const items = query.trim()
                ? this.getItems().filter(i => i.label.toLowerCase().includes(query.toLowerCase()))
                : this.getItems();
            this.render(items);
        },

        render(items) {
            if (!this.results) return;
            if (!items.length) {
                this.results.innerHTML =
                    '<li class="palette-result-item" style="opacity:0.5;cursor:default;pointer-events:none;">No results</li>';
                return;
            }
            this.results.innerHTML = items.map((item, i) =>
                `<li class="palette-result-item${i === 0 ? ' palette-active' : ''}" role="option" data-index="${i}" tabindex="-1"><i class="pi ${item.icon}"></i><span>${item.label}</span></li>`
            ).join('');

            this.results.querySelectorAll('.palette-result-item[data-index]').forEach(el => {
                el.addEventListener('mousedown', (e) => {
                    e.preventDefault(); // keep focus on input
                    this.execute(items[+el.dataset.index]);
                });
            });
        },

        navigate(e) {
            const items = this.results?.querySelectorAll('.palette-result-item[data-index]');
            if (!items?.length) return;
            const active = this.results.querySelector('.palette-active');
            let idx = active ? +active.dataset.index : -1;

            if (e.key === 'ArrowDown') {
                e.preventDefault();
                idx = (idx + 1) % items.length;
            } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                idx = (idx - 1 + items.length) % items.length;
            } else if (e.key === 'Enter') {
                e.preventDefault();
                if (active) {
                    const visible = this.input?.value.trim()
                        ? this.getItems().filter(i => i.label.toLowerCase().includes(this.input.value.toLowerCase()))
                        : this.getItems();
                    this.execute(visible[+active.dataset.index]);
                }
                return;
            } else {
                return;
            }

            items.forEach(el => el.classList.remove('palette-active'));
            items[idx]?.classList.add('palette-active');
            items[idx]?.scrollIntoView({ block: 'nearest' });
        },

        execute(item) {
            if (!item) return;
            this.close();
            if (item.action) item.action();
            else if (item.url) window.location.href = item.url;
        }
    };

    // ─── Config panel ─────────────────────────────────────

    function openConfig() {
        document.getElementById('config-panel')?.setAttribute('aria-hidden', 'false');
    }

    // ─── Init ─────────────────────────────────────────────

    document.addEventListener('DOMContentLoaded', () => {
        restoreTheme();
        restoreMenuLayout();
        restoreMenuTheme();
        restoreInputStyle();
        restoreRtl();
        palette.init();
        aiPanel.init();

        // Close topbar dropdowns when clicking outside
        document.addEventListener('click', (e) => {
            if (!e.target.closest('.topbar-item')) closeAllDropdowns();

            // Close overlay sidebar when clicking outside it
            const wrapper = document.querySelector('.layout-wrapper');
            if (wrapper?.classList.contains('layout-menu-overlay') &&
                wrapper?.classList.contains('layout-menu-active') &&
                !e.target.closest('.layout-sidebar') &&
                !e.target.closest('.topbar-menubutton')) {
                wrapper.classList.remove('layout-menu-active');
            }
        });
    });

    return { setTheme, cycleTheme, setMenuLayout, setMenuTheme, setInputStyle, setRtl, toggleMenu, toggleDropdown, closeAllDropdowns, toggleAiPanel, setAiStatus, openConfig, palette, aiPanel };
})();
