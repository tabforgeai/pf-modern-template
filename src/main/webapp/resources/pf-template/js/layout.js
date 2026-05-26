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
            DemoAgent.simulate(text);
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

    // ─── Agent Event Bus ──────────────────────────────────

    const AgentEventBus = {
        _listeners: {},

        on(type, fn) {
            if (!this._listeners[type]) this._listeners[type] = [];
            this._listeners[type].push(fn);
        },

        emit(event) {
            const handlers = this._listeners[event.type] || [];
            const wildcards = this._listeners['*'] || [];
            [...handlers, ...wildcards].forEach(fn => fn(event));
        },

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
        palette.init();
        aiPanel.init();
        activityPanel.init();

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

    return { setTheme, cycleTheme, setMenuLayout, setMenuTheme, setInputStyle, setRtl, toggleMenu, toggleDropdown, closeAllDropdowns, toggleAiPanel, setAiStatus, openConfig, palette, aiPanel, activityPanel, AgentEventBus, RendererRegistry, AgentTransport, DemoAgent, PluginRegistry, registerPlugin };
})();
