'use strict';

const PFTemplate = (() => {

    // ─── Theme ────────────────────────────────────────────

    const THEMES = ['light', 'dark', 'dim'];

    // PrimeFaces 15 "styled mode" themes switch to dark via this class on <html>.
    // Both our 'dark' and 'dim' themes map to PrimeFaces dark mode so that
    // PrimeFaces components (cards, tables, inputs) follow the template theme.
    // If your PrimeFaces theme uses a different dark-mode selector, change it here.
    const PF_DARK_CLASS = 'p-dark';

    // Keeps PrimeFaces component theming in sync with the template theme.
    function syncPrimeFacesDark(name) {
        const dark = (name === 'dark' || name === 'dim');
        document.documentElement.classList.toggle(PF_DARK_CLASS, dark);
    }

    function setTheme(name) {
        document.documentElement.dataset.theme = name;
        syncPrimeFacesDark(name);
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
            syncPrimeFacesDark(saved);
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

    // ─── System Prompt ────────────────────────────────────
    // Stored in localStorage. Restored to the Config panel textarea on DOMContentLoaded.
    // Included as `systemPrompt` in every user_message event so the app can prepend it
    // to the AI context without the template needing to know the AI provider or format.

    let _systemPrompt = '';

    /**
     * Set and persist the system prompt.
     * Called by the Config panel textarea's oninput handler and by app code.
     *
     * @param {string} value — new system prompt text. Pass '' to clear.
     * @called-from config.xhtml oninput; app code via PFTemplate.setSystemPrompt().
     * @returns {void}
     */
    function setSystemPrompt(value) {
        _systemPrompt = value || '';
        localStorage.setItem('pft-system-prompt', _systemPrompt);
    }

    /** Restore system prompt from localStorage and populate the Config panel textarea. */
    function restoreSystemPrompt() {
        const saved = localStorage.getItem('pft-system-prompt');
        if (saved) {
            _systemPrompt = saved;
            const el = document.getElementById('config-system-prompt');
            if (el) el.value = saved;
        }
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
        _msgCounter: 0,

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

        switchTab(tab) {
            document.querySelectorAll('.ai-tab-btn').forEach(btn => {
                const active = btn.dataset.tab === tab;
                btn.classList.toggle('ai-tab-active', active);
                btn.setAttribute('aria-selected', active ? 'true' : 'false');
            });
            document.querySelectorAll('.ai-tab-pane').forEach(pane => {
                pane.classList.toggle('ai-tab-pane-active', pane.id === 'ai-tab-' + tab);
            });
            if (tab === 'activity') activityPanel.resetBadge();
        },

        /**
         * Capture the current text input and pending attachments, then initiate a
         * chat exchange: append the user message, emit an InputEvent, clear the input,
         * and start the AI demo stream.
         *
         * Requires at least one of: non-empty text OR at least one attachment.
         * Analogous to hitting "Submit" in a form — collects all fields, validates
         * presence, then dispatches.
         *
         * @called-from Send button onclick (template.xhtml) and Enter key handler (aiPanel.init).
         * @returns {void}
         */
        send() {
            if (this.isStreaming || !this.inputEl) return;
            const text        = this.inputEl.value.trim();
            const attachments = MultimodalInput.getAttachments();
            if (!text && !attachments.length) return;

            this.lastUserText = text;
            this.inputEl.value = '';
            this.inputEl.style.height = 'auto';
            this._hideEmpty();
            this._appendUser(text, attachments);

            // Snapshot File objects BEFORE clear() so they are available inside the
            // InputEventBus callback — callers that need to upload bytes (e.g. via FormData
            // + fetch) can read event.files[n].file. The File objects remain valid as long
            // as any variable holds a reference; clear() only removes the template's copy.
            const files = MultimodalInput._attachments.map(function(a) { return { id: a.id, file: a.file }; });

            // Notify the consuming application (backend AI service) with the full
            // user message payload. The template emits; the app decides what to do.
            // event.attachments = serializable metadata (safe for JSON.stringify / SSE).
            // event.files       = native File objects (usable with FormData/fetch; not JSON-safe).
            InputEventBus.emit({ type: 'user_message', text, attachments, files: files, systemPrompt: _systemPrompt, timestamp: new Date().toISOString() });

            MultimodalInput.clear();

            // ── Demo vs. real backend ─────────────────────────
            // Everything below is SIMULATION. With a real backend you set
            // DemoAgent.enabled = false; the message has already left the browser
            // via InputEventBus.emit(...) above. Your application forwards it to
            // the backend and renders the reply by calling aiPanel.streamAssistant(text)
            // (or by emitting an 'assistant_message' event on AgentEventBus — see
            // the wiring in DOMContentLoaded). Until then we just show "thinking".
            if (!DemoAgent.enabled) {
                setAiStatus('thinking');
                return;
            }

            if (text) {
                this._stream(this._demoResponse(text));
                DemoAgent.simulate(text);
            } else {
                // Attachments-only send — stream an acknowledgement and simulate
                // agent activity so the Activity tab reflects processing, just as
                // it does for text messages.
                const n = attachments.length;
                const label = n === 1 ? attachments[0].name : n + ' files';
                this._stream('I received your ' + (n === 1 ? 'attachment' : n + ' attachments') + '. In a real deployment the backend would process ' + (n === 1 ? 'it' : 'them') + ' here — e.g. via an image analysis or document processing pipeline.');
                DemoAgent.simulate('Analyze: ' + label);
            }
        },

        /**
         * Render an assistant reply in the chat — the public entry point for a real
         * backend. Call this when your backend's response text is ready (e.g. from a
         * fetch callback, or an SSE/WebSocket message handler).
         *
         * Drives the same typewriter animation, markdown rendering, code-copy buttons
         * and action toolbar as the built-in demo. Always use this instead of touching
         * any private (_-prefixed) method.
         *
         * @param {string} text — the assistant's reply. Markdown is supported.
         *
         * @example
         *   PFTemplate.DemoAgent.enabled = false;               // turn off simulation
         *   PFTemplate.InputEventBus.on('user_message', (msg) => {
         *       fetch('/api/ai/chat', {
         *           method: 'POST',
         *           headers: { 'Content-Type': 'application/json' },
         *           body: JSON.stringify({ text: msg.text })
         *       })
         *       .then(r => r.text())
         *       .then(reply => PFTemplate.aiPanel.streamAssistant(reply));
         *   });
         *
         * @called-from Application code (fetch / SSE / WebSocket handlers), and the
         *   built-in 'assistant_message' bridge wired in DOMContentLoaded.
         * @returns {void}
         */
        streamAssistant(text) {
            if (typeof text !== 'string' || !text) return;
            this._hideEmpty();
            this._stream(text);
        },

        /**
         * Append a user message bubble (and optional attachment chips) to the chat area.
         *
         * Renders text as an escaped bubble and attachments as compact chips below it,
         * right-aligned per standard chat UI convention (user messages on the right).
         *
         * @param {string} text           — the typed message text. May be empty string when
         *   sending attachments only; in that case only chips are rendered.
         * @param {Array}  [attachments]  — serializable attachment descriptors from
         *   MultimodalInput.getAttachments(). Each: { id, type, mimeType, name, size }.
         *   Defaults to empty array; no chips rendered when empty.
         *
         * @called-from send(), right after capturing text/attachments and before clearing input.
         * @returns {void}
         */
        _appendUser(text, attachments = []) {
            const el = document.createElement('div');
            el.className = 'ai-message ai-message-user';
            let html = '<span class="ai-message-label">You</span>';
            if (text) html += '<div class="ai-message-bubble">' + this._esc(text) + '</div>';
            if (attachments.length) {
                const chips = attachments.map(a => {
                    const { icon, color } = MultimodalInput._chipIcon(a);
                    return '<div class="ai-sent-attachment"><i class="pi ' + icon + '" style="color:' + color + '"></i><span>' + this._esc(a.name) + '</span></div>';
                }).join('');
                html += '<div class="ai-sent-attachments">' + chips + '</div>';
            }
            el.innerHTML = html;
            this.messagesEl.appendChild(el);
            this._scrollBottom();
        },

        _stream(text) {
            this.isStreaming = true;
            if (this.sendBtn) this.sendBtn.disabled = true;
            setAiStatus('thinking');

            const wrapper = document.createElement('div');
            wrapper.className = 'ai-message ai-message-assistant';
            wrapper.dataset.messageId = 'msg-' + (this._msgCounter++);
            wrapper.innerHTML = '<span class="ai-message-label">AI Assistant</span><div class="ai-stream-bubble"><span class="ai-stream-text"></span><span class="ai-stream-cursor">▋</span></div>';
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
            this._addActionToolbar(wrapper, rawText);
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

        /**
         * Build and append the action toolbar below a completed AI response.
         *
         * Renders two built-in buttons (Retry, Copy) followed by any actions
         * registered via OutputActionRegistry. Analogous to a context toolbar in
         * an IDE (IntelliJ's "intention actions" row under a suggestion).
         *
         * The toolbar fades in on hover of the parent .ai-message-assistant element
         * via CSS — no JS hover handling needed.
         *
         * @param {HTMLElement} wrapper — the .ai-message-assistant div that holds the response.
         *   The toolbar is appended as the last child.
         * @param {string} rawText — the plain-text content of the response, passed as-is
         *   to OutputActionRegistry handlers so they can work with the raw string
         *   (no HTML entities, no markdown syntax).
         *
         * @called-from _finalizeAssistantMsg(), after markdown rendering and code-copy buttons
         *   have been applied to the bubble.
         * @returns {void}
         */
        _addActionToolbar(wrapper, rawText) {
            const toolbar = document.createElement('div');
            toolbar.className = 'ai-message-actions';

            // ── Retry (built-in) ──────────────────────────────
            const retryBtn = document.createElement('button');
            retryBtn.className = 'ai-action-btn';
            retryBtn.title = 'Retry';
            retryBtn.innerHTML = '<i class="pi pi-refresh"></i><span>Retry</span>';
            retryBtn.addEventListener('click', () => {
                wrapper.remove();
                this._stream(this._demoResponse(this.lastUserText));
            });
            toolbar.appendChild(retryBtn);

            // ── Copy message text (built-in) ──────────────────
            const copyBtn = document.createElement('button');
            copyBtn.className = 'ai-action-btn';
            copyBtn.title = 'Copy message';
            copyBtn.innerHTML = '<i class="pi pi-copy"></i><span>Copy</span>';
            copyBtn.addEventListener('click', () => {
                navigator.clipboard.writeText(rawText).then(() => {
                    copyBtn.querySelector('span').textContent = 'Copied!';
                    setTimeout(() => { copyBtn.querySelector('span').textContent = 'Copy'; }, 2000);
                });
            });
            toolbar.appendChild(copyBtn);

            // ── Speak / TTS (built-in, shown only when a handler is registered) ──
            if (TtsPlayer._handler) {
                const speakBtn = document.createElement('button');
                speakBtn.className = 'ai-action-btn';
                speakBtn.title = 'Speak';
                speakBtn.innerHTML = '<i class="pi pi-volume-up"></i><span>Speak</span>';
                speakBtn.addEventListener('click', () => TtsPlayer._speak(rawText, wrapper));
                toolbar.appendChild(speakBtn);
            }

            // ── Registered output actions (app-provided) ──────
            OutputActionRegistry.getAll().forEach(function(action) {
                const btn = document.createElement('button');
                btn.className = 'ai-action-btn';
                btn.title = action.title;
                btn.innerHTML = '<i class="pi ' + action.icon + '"></i><span>' + action.title + '</span>';
                btn.addEventListener('click', function() { action.handler(rawText, wrapper); });
                toolbar.appendChild(btn);
            });

            wrapper.appendChild(toolbar);
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

    // ─── Agent Event Bus ──────────────────────────────────
    //
    // INBOUND channel: events flow FROM the backend agent TO the template.
    // The Activity Panel listens here to render timeline rows.
    // AgentTransport (SSE / WebSocket) feeds into this bus.

    const AgentEventBus = {
        _listeners: {},

        /**
         * Subscribe to a specific agent event type.
         *
         * Use type '*' to receive every event regardless of type — useful for
         * logging, debugging, or building custom overlays on top of all events.
         *
         * @param {string}   type — agent event type ('tool_call', 'agent_finished', '*', …).
         *   Full list of built-in types: see doc/event-reference.md.
         * @param {Function} fn   — callback invoked with the full event object on match.
         *
         * @called-from activityPanel.init() (subscribes '*'), and application code
         *   that wants to react to specific agent events.
         * @returns {void}
         */
        on(type, fn) {
            if (!this._listeners[type]) this._listeners[type] = [];
            this._listeners[type].push(fn);
        },

        /**
         * Dispatch an agent event to all matching listeners.
         *
         * Fires both the type-specific handler list AND the wildcard ('*') list.
         * Order: type-specific first, then wildcards — predictable, like DOM event bubbling.
         *
         * @param {object} event — agent event object. Required field: type (string).
         *   Recommended fields: id, timestamp, status, title, agent. See doc/event-reference.md.
         *
         * @called-from AgentTransport (SSE/WebSocket message handlers), DemoAgent.simulate(),
         *   and application code that emits events directly.
         * @returns {void}
         */
        emit(event) {
            const handlers = this._listeners[event.type] || [];
            const wildcards = this._listeners['*'] || [];
            [...handlers, ...wildcards].forEach(fn => fn(event));
        },

        /**
         * Remove all listeners from the bus.
         *
         * WARNING: this also removes the Activity Panel's listener registered in
         * activityPanel.init(). Use only in tests or when intentionally resetting.
         *
         * @called-from Test teardown, or before registering a completely fresh set of listeners.
         * @returns {void}
         */
        clear() {
            this._listeners = {};
        }
    };

    // ─── Input Event Bus ──────────────────────────────────
    //
    // OUTBOUND channel: events flow FROM the user (via the template) TO the backend.
    // This is the counterpart to AgentEventBus — one bus per direction keeps concerns clean,
    // analogous to separate request/response queues in a message broker (RabbitMQ, Kafka).
    //
    // Applications subscribe here to receive user messages (text + attachments):
    //   PFTemplate.InputEventBus.on('user_message', (msg) => { sendToAIBackend(msg); });

    const InputEventBus = {
        _listeners: {},

        /**
         * Subscribe to a specific input event type.
         *
         * The main event type is 'user_message'. Use '*' to catch all input events.
         * Called once at page-load time by the application to wire the backend.
         *
         * @param {string}   type — input event type. Currently: 'user_message'. Or '*' for all.
         * @param {Function} fn   — callback invoked with the event object when type matches.
         *   For 'user_message': fn receives { type, text, attachments[], timestamp }.
         *
         * @called-from Application code in <ui:insert name="scripts"> or a page-specific JS file,
         *   after the template has loaded.
         * @returns {void}
         */
        on(type, fn) {
            if (!this._listeners[type]) this._listeners[type] = [];
            this._listeners[type].push(fn);
        },

        /**
         * Fire an input event to all matching subscribers.
         *
         * @param {object} event — input event. Must have type (string).
         *   user_message shape: { type:'user_message', text:string, attachments:Array, timestamp:string }
         *   attachments[] items: { id, type, mimeType, name, size } — no File objects (not serializable).
         *
         * @called-from aiPanel.send(), immediately after capturing text and attachment metadata,
         *   before clearing the input field and starting the demo stream.
         * @returns {void}
         */
        emit(event) {
            const handlers = this._listeners[event.type] || [];
            const wildcards = this._listeners['*'] || [];
            [...handlers, ...wildcards].forEach(fn => fn(event));
        },

        /**
         * Remove all listeners. Use only in tests or to swap backend wiring at runtime.
         *
         * @called-from Test teardown.
         * @returns {void}
         */
        clear() {
            this._listeners = {};
        }
    };

    // ─── Event Renderer Registry ──────────────────────────

    const RendererRegistry = {
        _renderers: {},

        register(type, fn) {
            this._renderers[type] = fn;
        },

        render(event) {
            const fn = this._renderers[event.type] || this._renderers['_default'];
            return fn ? fn(event) : { icon: 'pi-circle', color: 'var(--text-color-secondary)', label: event.title || event.type };
        }
    };

    function _toolIcon(tool) {
        if (!tool) return 'pi-cog';
        const t = tool.toLowerCase();
        if (t.includes('browser') || t.includes('web') || t.includes('http')) return 'pi-globe';
        if (t.includes('database') || t.includes('db') || t.includes('sql')) return 'pi-database';
        if (t.includes('file') || t.includes('doc') || t.includes('pdf')) return 'pi-file';
        if (t.includes('email') || t.includes('mail')) return 'pi-envelope';
        if (t.includes('terminal') || t.includes('shell') || t.includes('exec')) return 'pi-terminal';
        if (t.includes('search') || t.includes('find')) return 'pi-search';
        if (t.includes('code') || t.includes('function') || t.includes('script')) return 'pi-code';
        if (t.includes('api') || t.includes('http') || t.includes('rest')) return 'pi-cloud';
        return 'pi-cog';
    }

    // Register built-in renderers
    RendererRegistry.register('agent_started',  () => ({ icon: 'pi-sparkles',            color: 'var(--primary-color)',          label: 'Agent started' }));
    RendererRegistry.register('agent_finished', () => ({ icon: 'pi-check-circle',         color: '#22c55e',                       label: 'Agent finished' }));
    RendererRegistry.register('tool_call',      (e) => ({ icon: _toolIcon(e.tool),         color: 'var(--text-color-secondary)',   label: e.title || e.tool || 'Tool call' }));
    RendererRegistry.register('tool_result',    (e) => ({ icon: _toolIcon(e.tool),         color: '#22c55e',                       label: e.title || 'Result received' }));
    RendererRegistry.register('reasoning',      () => ({ icon: 'pi-th-large',             color: 'var(--primary-color)',          label: 'Reasoning' }));
    RendererRegistry.register('browser_action', () => ({ icon: 'pi-globe',                color: 'var(--text-color-secondary)',   label: 'Browser action' }));
    RendererRegistry.register('file_operation', () => ({ icon: 'pi-file',                 color: 'var(--text-color-secondary)',   label: 'File operation' }));
    RendererRegistry.register('workflow_step',  () => ({ icon: 'pi-sitemap',              color: 'var(--primary-color)',          label: 'Workflow step' }));
    RendererRegistry.register('human_input_required', () => ({ icon: 'pi-user',           color: '#f59e0b',                       label: 'Input required' }));
    RendererRegistry.register('warning',        (e) => ({ icon: 'pi-exclamation-triangle', color: '#f59e0b',                      label: e.title || 'Warning' }));
    RendererRegistry.register('error',          (e) => ({ icon: 'pi-times-circle',         color: '#ef4444',                      label: e.title || 'Error' }));
    RendererRegistry.register('_default',       (e) => ({ icon: 'pi-circle',               color: 'var(--text-color-secondary)',  label: e.title || e.type }));

    // ─── Activity Panel ───────────────────────────────────

    const activityPanel = {
        timelineEl: null,
        emptyEl: null,
        agentLabelEl: null,
        badgeEl: null,
        _badgeCount: 0,
        _history: [],
        _replayActive: false,
        _autoSwitchTab: false,

        init() {
            this.timelineEl   = document.getElementById('ai-activity-timeline');
            this.emptyEl      = document.getElementById('ai-activity-empty');
            this.agentLabelEl = document.getElementById('ai-activity-agent');
            this.badgeEl      = document.getElementById('ai-activity-badge');

            AgentEventBus.on('*', (event) => this._onEvent(event));
        },

        _onEvent(event) {
            // 'assistant_message' is a chat-bubble event (routed into the chat by the
            // AgentEventBus bridge), not an agent activity step — keep it out of the timeline.
            if (event && event.type === 'assistant_message') return;
            this._history.push({ event, ts: performance.now() });
            this._addEventRow(event);
        },

        configure(opts = {}) {
            if (opts.agentName     != null && this.agentLabelEl) this.agentLabelEl.textContent = opts.agentName;
            if (opts.autoSwitchTab != null) this._autoSwitchTab = opts.autoSwitchTab;
            if (opts.tabLabel) {
                const btn = document.querySelector('.ai-tab-btn[data-tab="activity"]');
                if (btn) {
                    Array.from(btn.childNodes).filter(n => n.nodeType === 3).forEach(n => n.remove());
                    const badge = btn.querySelector('.ai-tab-badge');
                    btn.insertBefore(document.createTextNode(opts.tabLabel), badge);
                }
            }
            if (opts.emptyTitle    && this.emptyEl) { const el = this.emptyEl.querySelector('.ai-empty-title');    if (el) el.textContent = opts.emptyTitle; }
            if (opts.emptySubtitle && this.emptyEl) { const el = this.emptyEl.querySelector('.ai-empty-subtitle'); if (el) el.textContent = opts.emptySubtitle; }
            return this;
        },

        _addEventRow(event, skipBadge) {
            if (this.emptyEl) this.emptyEl.style.display = 'none';

            const isActivityTabActive = document.getElementById('ai-tab-activity')?.classList.contains('ai-tab-pane-active');
            if (!isActivityTabActive && !skipBadge) this._incrementBadge();

            if (this._autoSwitchTab && !isActivityTabActive) {
                document.querySelector('.layout-wrapper')?.classList.add('ai-panel-open');
                aiPanel.switchTab('activity');
            }

            if (event.agent && this.agentLabelEl) this.agentLabelEl.textContent = event.agent;

            const rendered = RendererRegistry.render(event);
            const el = this._buildEl(event, rendered);

            if (this.timelineEl) {
                this.timelineEl.appendChild(el);
                this.timelineEl.scrollTop = this.timelineEl.scrollHeight;
            }
        },

        _buildEl(event, rendered) {
            const time = new Date(event.timestamp || Date.now()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
            const el = document.createElement('div');
            el.className = 'ai-event';
            el.dataset.status = event.status || 'running';
            el.dataset.id = event.id || '';

            const metaRows = [
                event.details && `<div class="ai-event-meta-row"><span class="ai-event-meta-key">Details</span><span>${this._esc(event.details)}</span></div>`,
                event.tool    && `<div class="ai-event-meta-row"><span class="ai-event-meta-key">Tool</span><span>${this._esc(event.tool)}</span></div>`,
                event.agent   && `<div class="ai-event-meta-row"><span class="ai-event-meta-key">Agent</span><span>${this._esc(event.agent)}</span></div>`,
                `<div class="ai-event-meta-row"><span class="ai-event-meta-key">Type</span><span>${this._esc(event.type)}</span></div>`,
                `<div class="ai-event-meta-row"><span class="ai-event-meta-key">Status</span><span>${this._esc(event.status || 'running')}</span></div>`
            ].filter(Boolean).join('');

            el.innerHTML = `<div class="ai-event-icon"><i class="pi ${rendered.icon}" style="color:${rendered.color}"></i></div><div class="ai-event-body"><div class="ai-event-title-row"><span class="ai-event-title">${this._esc(rendered.label)}</span><button class="ai-event-expand-btn" aria-label="Details"><i class="pi pi-chevron-right"></i></button></div><div class="ai-event-expanded" aria-hidden="true"><div class="ai-event-expanded-inner">${metaRows}</div></div></div><div class="ai-event-time">${time}</div>`;

            el.querySelector('.ai-event-expand-btn').addEventListener('click', (e) => {
                e.stopPropagation();
                const exp = el.querySelector('.ai-event-expanded');
                const btn = e.currentTarget;
                const open = exp.getAttribute('aria-hidden') === 'false';
                exp.setAttribute('aria-hidden', open ? 'true' : 'false');
                btn.classList.toggle('ai-event-expand-open', !open);
            });

            return el;
        },

        updateEvent(id, status, titleOverride) {
            const el = this.timelineEl?.querySelector(`[data-id="${id}"]`);
            if (!el) return;
            el.dataset.status = status;
            if (titleOverride) {
                const titleEl = el.querySelector('.ai-event-title');
                if (titleEl) titleEl.textContent = titleOverride;
            }
        },

        clear() {
            this._clearDisplay();
            this._history = [];
            if (this.agentLabelEl) this.agentLabelEl.textContent = '—';
            this._badgeCount = 0;
            this._updateBadge();
        },

        _clearDisplay() {
            if (!this.timelineEl) return;
            Array.from(this.timelineEl.children).forEach(c => { if (c !== this.emptyEl) c.remove(); });
            if (this.emptyEl) this.emptyEl.style.display = '';
        },

        replay() {
            if (!this._history.length || this._replayActive) return;
            this._replayActive = true;
            const history = [...this._history];
            this._clearDisplay();

            const firstTs = history[0].ts;
            history.forEach(({ event, ts }) => {
                setTimeout(() => {
                    this._addEventRow(event, true);
                    if (event.status === 'running') {
                        setTimeout(() => this.updateEvent(event.id, 'success'), 400);
                    }
                }, ts - firstTs);
            });

            const total = history[history.length - 1].ts - firstTs;
            setTimeout(() => { this._replayActive = false; }, total + 600);
        },

        showGraph() {
            const overlay = document.getElementById('agent-graph-overlay');
            if (!overlay) return;
            this._renderGraph();
            overlay.classList.add('graph-open');
            overlay.setAttribute('aria-hidden', 'false');
            overlay.addEventListener('mousedown', (e) => {
                if (e.target === overlay) this.closeGraph();
            }, { once: true });
        },

        closeGraph() {
            const overlay = document.getElementById('agent-graph-overlay');
            if (!overlay) return;
            overlay.classList.remove('graph-open');
            overlay.setAttribute('aria-hidden', 'true');
        },

        _renderGraph() {
            const container = document.getElementById('agent-graph-content');
            if (!container) return;
            if (!this._history.length) {
                container.innerHTML = '<p class="agent-graph-empty">No events to display. Send a message first.</p>';
                return;
            }
            container.innerHTML = this._history.map(({ event }, i) => {
                const rendered = RendererRegistry.render(event);
                const status = event.status || 'running';
                const connector = i < this._history.length - 1 ? '<div class="graph-connector"></div>' : '';
                return `<div class="graph-node graph-node-${status}"><div class="graph-node-icon"><i class="pi ${rendered.icon}" style="color:${rendered.color}"></i></div><div class="graph-node-body"><div class="graph-node-title">${this._esc(rendered.label)}</div>${event.details ? `<div class="graph-node-detail">${this._esc(event.details)}</div>` : ''}</div><span class="graph-node-badge badge-${status}">${this._statusLabel(status)}</span></div>${connector}`;
            }).join('');
        },

        _statusLabel(status) {
            const labels = { running: 'running', success: 'success', error: 'error', warning: 'warning', waiting: 'waiting', queued: 'queued', cancelled: 'cancelled' };
            return labels[status] || status || 'unknown';
        },

        _incrementBadge() {
            this._badgeCount++;
            this._updateBadge();
        },

        _updateBadge() {
            if (!this.badgeEl) return;
            if (this._badgeCount > 0) {
                this.badgeEl.textContent = this._badgeCount > 9 ? '9+' : this._badgeCount;
                this.badgeEl.classList.add('ai-tab-badge-visible');
            } else {
                this.badgeEl.classList.remove('ai-tab-badge-visible');
            }
        },

        resetBadge() {
            this._badgeCount = 0;
            this._updateBadge();
        },

        _esc(str) {
            return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
        }
    };

    // ─── Agent Transport (SSE / WebSocket with auto-reconnect) ──

    const AgentTransport = {
        _source: null,
        _socket: null,
        _sseUrl: null,
        _wsUrl: null,
        _sseOpts: {},
        _wsOpts: {},

        connectSSE(url, opts = {}) {
            this._sseUrl = url;
            this._sseOpts = { reconnectDelay: 3000, ...opts };
            this._doConnectSSE();
        },

        _doConnectSSE() {
            if (this._source) this._source.close();
            this._source = new EventSource(this._sseUrl);
            this._source.onmessage = (e) => {
                try { AgentEventBus.emit(JSON.parse(e.data)); } catch (_) {}
            };
            this._source.onerror = () => {
                AgentEventBus.emit({ type: 'warning', status: 'warning', title: 'SSE reconnecting…', timestamp: new Date().toISOString() });
                this._source.close();
                if (this._sseUrl) setTimeout(() => this._doConnectSSE(), this._sseOpts.reconnectDelay);
            };
        },

        connectWebSocket(url, opts = {}) {
            this._wsUrl = url;
            this._wsOpts = { reconnectDelay: 3000, ...opts };
            this._doConnectWebSocket();
        },

        _doConnectWebSocket() {
            if (this._socket) this._socket.close();
            this._socket = new WebSocket(this._wsUrl);
            this._socket.onmessage = (e) => {
                try { AgentEventBus.emit(JSON.parse(e.data)); } catch (_) {}
            };
            this._socket.onerror = () => {
                AgentEventBus.emit({ type: 'warning', status: 'warning', title: 'WebSocket error', timestamp: new Date().toISOString() });
            };
            this._socket.onclose = () => {
                if (this._wsUrl) setTimeout(() => this._doConnectWebSocket(), this._wsOpts.reconnectDelay);
            };
        },

        disconnect() {
            this._sseUrl = null;
            this._wsUrl  = null;
            this._source?.close();
            this._socket?.close();
            this._source = null;
            this._socket = null;
        }
    };

    // ─── Demo Agent ───────────────────────────────────────
    // Simulates agent events for development/demo purposes.
    // Set DemoAgent.enabled = false (or remove wiring in DOMContentLoaded)
    // when connecting a real backend via AgentTransport.

    const DemoAgent = {
        enabled: true,

        simulate(userText) {
            if (!this.enabled) return;
            const snippet = userText.length > 40 ? userText.substring(0, 40) + '…' : userText;
            const isCode = userText.toLowerCase().includes('code') || userText.toLowerCase().includes('example');
            const ts = () => new Date().toISOString();
            const mkId = (n) => 'demo-' + Date.now() + '-' + n;

            const steps = [
                [0,    { id: mkId(0), type: 'agent_started', status: 'running', title: 'Processing request',       agent: 'AssistantAgent', details: `"${snippet}"` }, 300],
                [400,  { id: mkId(1), type: 'reasoning',     status: 'running', title: 'Analyzing query',          agent: 'AssistantAgent' }, 300],
                [800,  { id: mkId(2), type: 'tool_call',     status: 'running', title: 'Searching knowledge base', agent: 'AssistantAgent', tool: 'database.search', details: 'Retrieving relevant context' }, 650],
                [1500, { id: mkId(3), type: 'tool_result',   status: 'success', title: 'Found relevant context',   agent: 'AssistantAgent', tool: 'database.search', details: '3 results returned' }, null],
                ...(isCode ? [
                    [1900, { id: mkId(4), type: 'tool_call',   status: 'running', title: 'Fetching code snippet',  agent: 'AssistantAgent', tool: 'code.fetch', details: 'Retrieving example' }, 600],
                    [2550, { id: mkId(5), type: 'tool_result', status: 'success', title: 'Code snippet ready',     agent: 'AssistantAgent', tool: 'code.fetch' }, null]
                ] : []),
                [isCode ? 3000 : 1900, { id: mkId(6), type: 'reasoning',     status: 'running', title: 'Composing response', agent: 'AssistantAgent', details: 'Synthesizing results' }, 350],
                [isCode ? 3400 : 2300, { id: mkId(7), type: 'agent_finished', status: 'success', title: 'Response ready',    agent: 'AssistantAgent' }, null]
            ];

            steps.forEach(([delay, evt, resolveMs]) => {
                setTimeout(() => {
                    AgentEventBus.emit({ ...evt, timestamp: ts() });
                    if (resolveMs !== null) setTimeout(() => activityPanel.updateEvent(evt.id, 'success'), resolveMs);
                }, delay);
            });
        }
    };

    // ─── Plugin Registry ──────────────────────────────────
    // Register a plugin: { id, label, renderers: { 'type': (evt) => {icon, color, label} } }
    // Each plugin registers its event types into RendererRegistry.

    const PluginRegistry = {
        _plugins: {},

        register(descriptor) {
            if (!descriptor?.id) throw new Error('[PluginRegistry] descriptor must have an id');
            this._plugins[descriptor.id] = descriptor;
            if (descriptor.renderers) {
                Object.entries(descriptor.renderers).forEach(([type, fn]) => RendererRegistry.register(type, fn));
            }
        },

        list() {
            return Object.values(this._plugins).map(p => ({ id: p.id, label: p.label || p.id }));
        }
    };

    function registerPlugin(descriptor) {
        PluginRegistry.register(descriptor);
    }

    // ─── Output Action Registry ───────────────────────────
    //
    // Manages custom action buttons rendered below every AI response in the chat.
    // Applications use registerOutputAction() to add domain-specific actions:
    // translation, TTS, email, create-task, etc.
    //
    // Two built-in actions (Retry, Copy) are always rendered first regardless of
    // this registry — they live directly in aiPanel._addActionToolbar().
    //
    // Analogous to IDE "intention actions" or email client "quick action" toolbars:
    // the framework defines the slot; the application fills it with its own actions.
    //
    // Usage:
    //   PFTemplate.registerOutputAction({
    //       type:    'translate',
    //       icon:    'pi-language',
    //       title:   'Translate',
    //       handler: function(text, msgEl) { myApp.translate(text); }
    //   });

    const OutputActionRegistry = {
        _actions: [],

        /**
         * Register a custom output action button.
         *
         * The button appears to the right of the built-in Retry/Copy buttons
         * in the action toolbar below each AI response.
         *
         * @param {object}   def          — action definition object
         * @param {string}   def.type     — unique identifier (e.g. 'translate', 'tts').
         *   Used only as a key; not displayed to the user.
         * @param {string}   def.icon     — PrimeIcons CSS class without the 'pi ' prefix
         *   (e.g. 'pi-language', 'pi-volume-up'). See primefaces.org/icons.
         * @param {string}   def.title    — button label and tooltip text.
         * @param {Function} def.handler  — called when the user clicks the button.
         *   Receives (text: string, msgEl: HTMLElement):
         *     text   — plain-text content of the AI response (no HTML, no markdown syntax).
         *     msgEl  — the .ai-message-assistant wrapper div for the response.
         *
         * @called-from Application code in <ui:insert name="scripts"> or page-specific JS,
         *   after layout.js has loaded. May be called multiple times for multiple actions.
         * @returns {void}
         */
        register(def) {
            this._actions.push(def);
        },

        /**
         * Return a shallow copy of all registered actions.
         * Called by aiPanel._addActionToolbar() when building the toolbar for each response.
         *
         * @returns {Array<{type, icon, title, handler}>}
         */
        getAll() {
            return this._actions.slice();
        }
    };

    /**
     * Public shorthand for OutputActionRegistry.register().
     * Registers a custom action button shown below every AI response.
     *
     * @param {object} def — see OutputActionRegistry.register() for the full parameter spec.
     * @called-from Application page scripts.
     * @returns {void}
     */
    function registerOutputAction(def) {
        OutputActionRegistry.register(def);
    }

    // ─── TTS Player ───────────────────────────────────────
    //
    // Compact audio player bar that appears beneath an AI response when the
    // app registers a TTS provider via TtsPlayer.register().
    //
    // The template owns the playback chrome (play/pause, progress bar, close).
    // The app owns the audio bytes — it calls a TTS API and returns a Blob or URL.
    // Analogous to how MultimodalInput separates file handling (template) from
    // file processing (app): the template renders the UI, the app supplies the data.
    //
    // Usage:
    //   PFTemplate.TtsPlayer.register(async function(text) {
    //       const resp = await fetch('/api/tts', { method: 'POST', body: JSON.stringify({ text }) });
    //       return await resp.blob(); // or return a URL string
    //   });

    const TtsPlayer = {
        _handler: null,
        _current: null, // { audio, objectUrl, playerEl }

        /**
         * Register the TTS provider function.
         *
         * Once registered, a "Speak" button appears in the action toolbar of every
         * new AI response. Call register() before messages are streamed to ensure
         * full coverage — already-rendered messages do not gain the button.
         *
         * @param {Function} fn — async function(text: string) → Blob | string.
         *   Called with the plain-text AI response. Must return either a Blob
         *   (audio bytes, any browser-supported format) or a URL string.
         *   The template handles playback either way.
         *
         * @called-from Application code in <ui:insert name="scripts">.
         * @returns {void}
         */
        register(fn) {
            this._handler = fn;
        },

        /**
         * Invoke the registered TTS handler and open the compact player bar.
         *
         * Stops any currently-playing audio first (single-player constraint).
         * Shows a loading spinner while the handler resolves, then swaps to the
         * full play/pause/progress player once audio is ready.
         *
         * @param {string}      text  — plain-text content of the AI response.
         * @param {HTMLElement} msgEl — .ai-message-assistant wrapper; player bar
         *   is appended as its last child, visible at all times (not hover-only).
         *
         * @called-from Speak button click handler in aiPanel._addActionToolbar().
         * @returns {Promise<void>}
         */
        async _speak(text, msgEl) {
            if (!this._handler) return;
            this._stop();

            const player = document.createElement('div');
            player.className = 'ai-tts-player ai-tts-loading';
            player.innerHTML = '<i class="pi pi-spin pi-spinner ai-tts-spinner"></i><span class="ai-tts-loading-text">Loading audio…</span><button class="ai-tts-close" type="button" title="Close"><i class="pi pi-times"></i></button>';
            player.querySelector('.ai-tts-close').addEventListener('click', () => this._stop());
            msgEl.appendChild(player);

            let url, objectUrl = null;
            try {
                const result = await this._handler(text);
                if (result instanceof Blob) {
                    objectUrl = URL.createObjectURL(result);
                    url = objectUrl;
                } else {
                    url = result;
                }
            } catch (_) {
                player.remove();
                return;
            }

            const audio = new Audio(url);
            this._current = { audio, objectUrl, playerEl: player };

            player.className = 'ai-tts-player';
            player.innerHTML = '<button class="ai-tts-play-btn" type="button" title="Play"><i class="pi pi-play"></i></button><div class="ai-tts-progress-wrap"><div class="ai-tts-progress-bar"><div class="ai-tts-progress-fill"></div></div><div class="ai-tts-time"><span class="ai-tts-current">0:00</span><span> / </span><span class="ai-tts-duration">0:00</span></div></div><button class="ai-tts-close" type="button" title="Close"><i class="pi pi-times"></i></button>';

            const playBtn    = player.querySelector('.ai-tts-play-btn');
            const playIcon   = playBtn.querySelector('.pi');
            const fill       = player.querySelector('.ai-tts-progress-fill');
            const currentEl  = player.querySelector('.ai-tts-current');
            const durationEl = player.querySelector('.ai-tts-duration');
            const progressBar = player.querySelector('.ai-tts-progress-bar');

            player.querySelector('.ai-tts-close').addEventListener('click', () => this._stop());

            playBtn.addEventListener('click', () => {
                if (audio.paused) { audio.play(); } else { audio.pause(); }
            });

            // Click anywhere on the progress bar to seek
            progressBar.addEventListener('click', (e) => {
                if (!audio.duration) return;
                const rect = progressBar.getBoundingClientRect();
                audio.currentTime = ((e.clientX - rect.left) / rect.width) * audio.duration;
            });

            audio.addEventListener('loadedmetadata', () => { durationEl.textContent = this._formatTime(audio.duration); });
            audio.addEventListener('timeupdate', () => {
                if (!audio.duration) return;
                fill.style.width = ((audio.currentTime / audio.duration) * 100) + '%';
                currentEl.textContent = this._formatTime(audio.currentTime);
            });
            audio.addEventListener('play',  () => { playIcon.className = 'pi pi-pause'; });
            audio.addEventListener('pause', () => { playIcon.className = 'pi pi-play'; });
            audio.addEventListener('ended', () => { playIcon.className = 'pi pi-play'; fill.style.width = '100%'; });
            audio.addEventListener('error', () => this._stop());

            audio.play().catch(() => {}); // silently ignore autoplay policy blocks
        },

        /**
         * Stop playback, revoke the object URL (if any), and remove the player bar.
         *
         * Safe to call when nothing is playing — returns immediately if _current is null.
         * Also called when a new Speak click displaces the current audio stream.
         *
         * @called-from _speak() before starting new audio, close button handler,
         *   and the audio error handler.
         * @returns {void}
         */
        _stop() {
            if (!this._current) return;
            const { audio, objectUrl, playerEl } = this._current;
            audio.pause();
            audio.src = '';
            if (objectUrl) URL.revokeObjectURL(objectUrl);
            if (playerEl.parentNode) playerEl.remove();
            this._current = null;
        },

        /**
         * Format a duration in seconds as M:SS (e.g. 0:00, 1:07, 12:34).
         *
         * @param {number} seconds — float from audio.duration or audio.currentTime.
         * @returns {string}
         *
         * @called-from loadedmetadata and timeupdate handlers inside _speak().
         */
        _formatTime(seconds) {
            const m = Math.floor(seconds / 60);
            const s = Math.floor(seconds % 60);
            return m + ':' + (s < 10 ? '0' : '') + s;
        }
    };

    // ─── Multimodal Input ─────────────────────────────────
    //
    // Unified attachment manager for the AI chat panel.
    // Handles three input sources: file picker buttons, drag-and-drop, and clipboard paste.
    //
    // Architecture analogy: this is the "attachment tray" you find in Gmail or Slack —
    // it buffers pending files, renders preview chips, and packages everything with the
    // outgoing message when the user hits Send.
    //
    // The template NEVER reads file content for AI purposes. It only:
    //   • Validates type/size at the boundary (before any upload)
    //   • Stores File objects locally until Send
    //   • Emits serializable metadata via InputEventBus
    // The consuming application (backend) decides what to do with the files.

    const MultimodalInput = {

        /** @type {Array<{id,file,type,mimeType,name,size,previewUrl,status}>} */
        _attachments:   [],
        _chipsEl:       null, // #ai-attachments-row
        _dropIndicator: null, // #ai-drop-indicator
        _inputArea:     null, // #ai-panel-input-area (drag target)
        _nextId:        1,    // monotonic counter for attachment IDs

        /** Maximum bytes allowed per file. Override to change the limit for a specific deployment. */
        MAX_SIZE: 20 * 1024 * 1024,

        /**
         * MIME types accepted by the default file validation.
         * Empty array = accept any type. Override or extend for application-specific needs.
         * Intentionally broad — specific backends can further restrict on the server side.
         */
        ALLOWED_TYPES: [
            'image/png', 'image/jpeg', 'image/gif', 'image/webp', 'image/svg+xml',
            'application/pdf',
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            'text/csv', 'text/plain',
            'audio/mpeg', 'audio/wav', 'audio/ogg', 'audio/webm'
        ],

        /**
         * Wire up all three attachment input sources: file picker change events,
         * drag-and-drop onto the input area, and clipboard paste (Ctrl+V / Cmd+V).
         *
         * Uses a drag-depth counter (not a boolean) to correctly handle
         * dragenter/dragleave flickering when the pointer crosses child-element
         * boundaries inside the drop zone — a well-known browser quirk with drag events.
         *
         * @called-from DOMContentLoaded, after aiPanel.init() and activityPanel.init().
         * @returns {void}
         */
        init() {
            this._chipsEl       = document.getElementById('ai-attachments-row');
            this._dropIndicator = document.getElementById('ai-drop-indicator');
            this._inputArea     = document.getElementById('ai-panel-input-area');
            if (!this._inputArea) return;

            // File picker buttons: reset value after each selection so the same
            // file can be re-selected if the user removes and re-adds it.
            const filePicker  = document.getElementById('ai-file-picker');
            const imagePicker = document.getElementById('ai-image-picker');
            if (filePicker)  filePicker.addEventListener('change',  (e) => { this.addFiles(e.target.files); e.target.value = ''; });
            if (imagePicker) imagePicker.addEventListener('change', (e) => { this.addFiles(e.target.files); e.target.value = ''; });

            // Drag counter: each dragenter increments, each dragleave decrements.
            // Indicator shows only while counter > 0, preventing flicker on child crossings.
            let _dragDepth = 0;
            this._inputArea.addEventListener('dragenter', (e) => {
                e.preventDefault();
                if (++_dragDepth === 1 && this._dropIndicator) this._dropIndicator.classList.add('ai-drop-active');
            });
            this._inputArea.addEventListener('dragleave', () => {
                if (--_dragDepth <= 0) { _dragDepth = 0; if (this._dropIndicator) this._dropIndicator.classList.remove('ai-drop-active'); }
            });
            this._inputArea.addEventListener('dragover', (e) => e.preventDefault());
            this._inputArea.addEventListener('drop', (e) => {
                e.preventDefault();
                _dragDepth = 0;
                if (this._dropIndicator) this._dropIndicator.classList.remove('ai-drop-active');
                if (e.dataTransfer.files.length) this.addFiles(e.dataTransfer.files);
            });

            // Clipboard paste: intercept only when image items are present.
            // Text-only pastes fall through to the browser's default textarea behavior.
            const textarea = document.getElementById('ai-panel-input');
            if (textarea) {
                textarea.addEventListener('paste', (e) => {
                    const imageItems = Array.from(e.clipboardData?.items || []).filter(i => i.kind === 'file' && i.type.startsWith('image/'));
                    if (!imageItems.length) return;
                    e.preventDefault(); // suppress raw data-URL text insertion
                    this.addFiles(imageItems.map(i => i.getAsFile()).filter(Boolean));
                });
            }
        },

        /**
         * Add one or more files to the pending attachment store.
         *
         * Single entry point for all three input sources (picker, drag-drop, paste).
         * Each file is validated first; rejected files show a transient error chip
         * and also emit a warning event to the AgentEventBus (visible in Activity tab).
         * Accepted image files get a thumbnail preview loaded asynchronously via FileReader.
         *
         * Uses a for-loop rather than Array.from + forEach because FileList is not a
         * true Array — it lacks .forEach() in some older browser environments.
         *
         * @param {FileList|File[]} fileList — native FileList from input.files / dataTransfer.files,
         *   or a plain Array<File> built from clipboard DataTransferItem.getAsFile() calls.
         *
         * @called-from file picker change handlers, drop handler, and paste handler (all in init).
         * @returns {void}
         */
        addFiles(fileList) {
            for (let i = 0; i < fileList.length; i++) {
                const file = fileList[i];
                if (!file) continue;
                const err = this._validate(file);
                if (err) {
                    AgentEventBus.emit({ type: 'warning', status: 'warning', title: 'Attachment rejected', details: err, timestamp: new Date().toISOString() });
                    this._addErrorChip(file.name, err);
                    continue;
                }
                const attachment = { id: 'att-' + (this._nextId++), file, type: this._classifyType(file.type), mimeType: file.type, name: file.name, size: file.size, previewUrl: null, status: 'ready' };
                this._attachments.push(attachment);
                // Load image thumbnails asynchronously — chip appears immediately with an icon,
                // then swaps to <img> once FileReader finishes (non-blocking).
                if (attachment.type === 'image') {
                    const reader = new FileReader();
                    reader.onload = (ev) => { attachment.previewUrl = ev.target.result; this._updateChipPreview(attachment); };
                    reader.readAsDataURL(file);
                }
                this._addChip(attachment);
            }
            this._updateChipsVisibility();
        },

        /**
         * Validate a single file against size and MIME type constraints.
         *
         * Mirrors server-side input validation — check at the earliest possible moment
         * (before any upload) to give instant, zero-latency feedback to the user.
         * The server should still validate; this is a UX convenience, not a security gate.
         *
         * @param {File} file — native File object. .size is always reliable; .type may be
         *   empty string for unusual or OS-specific file types.
         * @returns {string|null} — null = file passes all checks and may be accepted.
         *   Non-null string = human-readable rejection reason, shown as an error chip.
         *
         * @called-from addFiles(), per file, before adding it to _attachments.
         */
        _validate(file) {
            if (file.size > this.MAX_SIZE) return file.name + ' exceeds ' + (this.MAX_SIZE / 1024 / 1024).toFixed(0) + ' MB limit';
            if (this.ALLOWED_TYPES.length && !this.ALLOWED_TYPES.includes(file.type)) return file.name + ': unsupported type (' + (file.type || 'unknown') + ')';
            return null;
        },

        /**
         * Map a MIME type to a simplified display category used for icon and color selection.
         *
         * Analogous to a content-type resolver in a file manager (Finder, Explorer) —
         * the raw MIME string is too granular for UI purposes; this maps it to a small
         * set of categories that drive consistent visual presentation.
         *
         * @param {string} mimeType — MIME type string, e.g. 'image/png', 'application/pdf'.
         *   An empty string is mapped to 'other'.
         * @returns {'image'|'pdf'|'spreadsheet'|'document'|'audio'|'text'|'other'}
         *
         * @called-from addFiles(), when building the attachment descriptor object.
         */
        _classifyType(mimeType) {
            if (mimeType.startsWith('image/'))       return 'image';
            if (mimeType === 'application/pdf')      return 'pdf';
            if (mimeType.includes('spreadsheet') || mimeType === 'text/csv') return 'spreadsheet';
            if (mimeType.includes('wordprocessing')) return 'document';
            if (mimeType.startsWith('audio/'))       return 'audio';
            if (mimeType.startsWith('text/'))        return 'text';
            return 'other';
        },

        /**
         * Build and insert a preview chip for a valid attachment.
         *
         * Image chips initially show an icon placeholder; the actual thumbnail is
         * swapped in asynchronously by _updateChipPreview() when FileReader completes.
         * All other types show the appropriate type icon immediately and permanently.
         *
         * @param {object} attachment — descriptor built in addFiles():
         *   { id, file, type, mimeType, name, size, previewUrl:null, status:'ready' }
         *
         * @called-from addFiles(), once per accepted file, after pushing to _attachments.
         * @returns {void}
         */
        _addChip(attachment) {
            if (!this._chipsEl) return;
            this._chipsEl.appendChild(this._buildChip(attachment));
        },

        /**
         * Construct the DOM element for a single attachment chip.
         *
         * Visual design mirrors Gmail / Slack attachment chips: compact card with
         * icon (or thumbnail), truncated filename, file size, and a remove (×) button.
         * The × button is wired directly to removeAttachment() to stay decoupled from
         * any event delegation.
         *
         * HTML is built with string concatenation (not template literals) to stay
         * compatible with Eclipse JSDT's single-line template literal requirement.
         *
         * @param {object} attachment — same descriptor as _addChip().
         * @returns {HTMLElement} — a fully wired chip <div> ready for DOM insertion.
         *
         * @called-from _addChip().
         */
        _buildChip(attachment) {
            const chip = document.createElement('div');
            chip.className = 'ai-attachment-chip';
            chip.dataset.attachId = attachment.id;
            const { icon, color } = this._chipIcon(attachment);
            // For images: start with icon placeholder (data-attach-icon attribute is the lookup key
            // used by _updateChipPreview to swap it with the real thumbnail once loaded).
            const iconHtml = attachment.type === 'image'
                ? '<div class="ai-attachment-icon ai-attachment-img-placeholder" data-attach-icon="' + attachment.id + '"><i class="pi ' + icon + '" style="color:' + color + '"></i></div>'
                : '<div class="ai-attachment-icon"><i class="pi ' + icon + '" style="color:' + color + '"></i></div>';
            chip.innerHTML = iconHtml + '<div class="ai-attachment-info"><span class="ai-attachment-name" title="' + this._esc(attachment.name) + '">' + this._esc(attachment.name) + '</span><span class="ai-attachment-size">' + this._formatSize(attachment.size) + '</span></div><button class="ai-attachment-remove" type="button" aria-label="Remove attachment"><i class="pi pi-times"></i></button>';
            chip.querySelector('.ai-attachment-remove').addEventListener('click', () => this.removeAttachment(attachment.id));
            return chip;
        },

        /**
         * Swap the icon placeholder in an image chip for an actual <img> thumbnail,
         * once FileReader has finished loading the file as a base64 data URL.
         *
         * This is called asynchronously via FileReader.onload — the chip is already
         * in the DOM by this point, so the replacement happens in place (no re-render).
         * base64 data URLs are regular strings; no revokeObjectURL is needed.
         *
         * @param {object} attachment — same descriptor; previewUrl is now populated
         *   with a 'data:image/...;base64,...' string from FileReader.readAsDataURL().
         *
         * @called-from addFiles() → FileReader.onload callback (asynchronous).
         * @returns {void}
         */
        _updateChipPreview(attachment) {
            if (!this._chipsEl || !attachment.previewUrl) return;
            const placeholder = this._chipsEl.querySelector('[data-attach-icon="' + attachment.id + '"]');
            if (!placeholder) return;
            const img = document.createElement('img');
            img.className = 'ai-attachment-thumb';
            img.src = attachment.previewUrl;
            img.alt = attachment.name;
            placeholder.replaceWith(img);
        },

        /**
         * Display a temporary error chip when a file fails validation.
         *
         * Auto-removes after 3 seconds — consistent with toast notification conventions
         * (brief, non-blocking, no user action required to dismiss).
         * Also emits a warning to the AgentEventBus so the Activity tab can log it.
         *
         * @param {string} name — filename displayed in the chip for context.
         * @param {string} msg  — rejection reason string returned by _validate().
         *
         * @called-from addFiles(), for each file where _validate() returned non-null.
         * @returns {void}
         */
        _addErrorChip(name, msg) {
            if (!this._chipsEl) return;
            this._updateChipsVisibility(true);
            const chip = document.createElement('div');
            chip.className = 'ai-attachment-chip ai-attachment-chip-error';
            chip.innerHTML = '<div class="ai-attachment-icon"><i class="pi pi-times-circle" style="color:#ef4444"></i></div><div class="ai-attachment-info"><span class="ai-attachment-name" title="' + this._esc(msg) + '">' + this._esc(name) + '</span><span class="ai-attachment-size" style="color:#ef4444">Rejected</span></div>';
            this._chipsEl.appendChild(chip);
            setTimeout(() => { chip.remove(); this._updateChipsVisibility(); }, 3000);
        },

        /**
         * Remove a pending attachment by its ID.
         *
         * Splices the descriptor out of _attachments, removes the chip from the DOM,
         * and hides the chip row if no attachments remain. The File object is freed for
         * garbage collection when the last reference (the descriptor) is removed.
         *
         * @param {string} id — attachment ID in the form 'att-N', assigned in addFiles().
         *   Also set as data-attach-id on the chip <div> for O(1) DOM lookup via querySelector.
         *
         * @called-from chip remove button click handler, wired in _buildChip().
         * @returns {void}
         */
        removeAttachment(id) {
            const idx = this._attachments.findIndex(a => a.id === id);
            if (idx !== -1) this._attachments.splice(idx, 1);
            this._chipsEl?.querySelector('[data-attach-id="' + id + '"]')?.remove();
            this._updateChipsVisibility();
        },

        /**
         * Clear all pending attachments and reset the chip row to hidden.
         *
         * Called automatically by aiPanel.send() after packaging attachments into the
         * outgoing InputEvent — ensures each message starts with a clean slate.
         * File objects are released for garbage collection when _attachments is reassigned.
         *
         * @called-from aiPanel.send(), after getAttachments() has already captured a snapshot.
         * @returns {void}
         */
        clear() {
            this._attachments = [];
            if (this._chipsEl) this._chipsEl.innerHTML = '';
            this._updateChipsVisibility();
        },

        /**
         * Return serializable metadata for all pending attachments.
         *
         * Intentionally excludes the native File object because File is not
         * JSON-serializable and should not cross the template/application boundary directly.
         * Callers that need the raw bytes (e.g. to POST to a storage endpoint) can access
         * this._attachments to get the full descriptor including the File reference.
         *
         * @returns {Array<{id, type, mimeType, name, size}>} — snapshot of pending attachments.
         *   Empty array if no files are pending. Safe to JSON.stringify().
         *
         * @called-from aiPanel.send(), to build the user_message payload for InputEventBus.
         * @called-from aiPanel._appendUser(), to render sent-message chips.
         */
        getAttachments() {
            return this._attachments.map(a => ({ id: a.id, type: a.type, mimeType: a.mimeType, name: a.name, size: a.size }));
        },

        /**
         * Show or hide the chip row based on whether content is present.
         *
         * Uses display:flex/none (not a CSS class) because the element is initialized
         * with inline style="display:none" in template.xhtml — this ensures the correct
         * initial hidden state before JavaScript loads, preventing a flash of empty space.
         *
         * @param {boolean} [forceShow] — when true, show the row even if _attachments is
         *   empty (needed for error chips that appear before any valid file is added).
         *
         * @called-from addFiles(), removeAttachment(), clear(), _addErrorChip().
         * @returns {void}
         */
        _updateChipsVisibility(forceShow) {
            if (!this._chipsEl) return;
            const hasContent = forceShow || this._attachments.length > 0 || this._chipsEl.children.length > 0;
            this._chipsEl.style.display = hasContent ? 'flex' : 'none';
        },

        /**
         * Return the PrimeIcons icon class and CSS color for a given attachment category.
         *
         * Follows the same icon-mapping pattern as RendererRegistry built-in renderers —
         * a category string maps to a { icon, color } visual descriptor.
         * Also used by aiPanel._appendUser() for the sent-message chips.
         *
         * @param {object} attachment — needs only the .type field (e.g. 'image', 'pdf').
         *   As classified by _classifyType() when the attachment was created.
         * @returns {{ icon: string, color: string }} — icon is a PrimeIcons class (e.g. 'pi-image');
         *   color is a CSS color value or CSS custom property reference.
         *
         * @called-from _buildChip() and aiPanel._appendUser().
         */
        _chipIcon(attachment) {
            const map = { image: { icon: 'pi-image', color: 'var(--primary-color)' }, pdf: { icon: 'pi-file-pdf', color: '#ef4444' }, spreadsheet: { icon: 'pi-table', color: '#22c55e' }, document: { icon: 'pi-file', color: '#3b82f6' }, audio: { icon: 'pi-volume-up', color: '#a855f7' }, text: { icon: 'pi-file', color: 'var(--text-color-secondary)' } };
            return map[attachment.type] || { icon: 'pi-paperclip', color: 'var(--text-color-secondary)' };
        },

        /**
         * Format a raw byte count as a human-readable size string.
         *
         * Matches OS file manager conventions (Finder, Windows Explorer):
         * MB for large, KB for medium, B for tiny files.
         *
         * @param {number} bytes — file size in bytes, from the native File.size property.
         *   Always a non-negative integer.
         * @returns {string} — e.g. '3.2 MB', '840 KB', '512 B'.
         *
         * @called-from _buildChip(), to display file size in the chip.
         */
        _formatSize(bytes) {
            if (bytes >= 1_000_000) return (bytes / 1_000_000).toFixed(1) + ' MB';
            if (bytes >= 1_000)     return (bytes / 1_000).toFixed(0) + ' KB';
            return bytes + ' B';
        },

        /**
         * Escape a string for safe HTML attribute / text node insertion.
         *
         * Prevents XSS from maliciously crafted filenames like '<script>alert(1)</script>.pdf'
         * or 'file" onmouseover="...".png'.
         *
         * @param {string} str — raw string, typically a filename or validation error message.
         * @returns {string} — HTML-safe version with &, <, >, " escaped to entity references.
         *
         * @called-from _buildChip(), _addErrorChip().
         */
        _esc(str) {
            return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
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
                if (e.key === 'Escape') {
                    const graphOverlay = document.getElementById('agent-graph-overlay');
                    if (graphOverlay?.getAttribute('aria-hidden') === 'false') activityPanel.closeGraph();
                }
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
        restoreSystemPrompt();
        palette.init();
        aiPanel.init();
        activityPanel.init();
        MultimodalInput.init();

        // Bridge: route a backend 'assistant_message' event into the chat bubble.
        // This lets a real backend deliver BOTH the chat reply AND activity events
        // over the single AgentTransport (SSE / WebSocket) channel — no extra JS
        // callback needed. Backend emits: { type:'assistant_message', text:'…' }.
        // (The other path — fetch + aiPanel.streamAssistant(reply) — works too.)
        AgentEventBus.on('assistant_message', (evt) => {
            if (evt && typeof evt.text === 'string') aiPanel.streamAssistant(evt.text);
        });

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

    return { setTheme, cycleTheme, setMenuLayout, setMenuTheme, setInputStyle, setRtl, toggleMenu, toggleDropdown, closeAllDropdowns, toggleAiPanel, setAiStatus, openConfig, palette, aiPanel, activityPanel, AgentEventBus, InputEventBus, RendererRegistry, AgentTransport, DemoAgent, PluginRegistry, registerPlugin, MultimodalInput, OutputActionRegistry, registerOutputAction, TtsPlayer, setSystemPrompt };
})();
