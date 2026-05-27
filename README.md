# PF Modern Template

A modern, production-ready application template built on **PrimeFaces 15**, **Jakarta EE 11**, and **Java 21**.

Beyond the standard rich web application template features — theming, responsive layout, navigation, command palette — this template includes a **generic, event-driven UI component system** for visualizing agent and workflow activity in real time.

Any backend system sends JSON events; the template receives and renders them with no knowledge of the source:

- AI agent frameworks (LangChain, LlamaIndex, custom Java agents)
- Orchestration engines (Temporal, Camunda, Apache Airflow)
- RAG pipelines and AI copilots
- Any workflow or automation system

The template does not know — and does not care — whether the events come from OpenAI, a custom LLM, a rule engine, or a batch job. It only knows how to render them.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| UI Components | PrimeFaces 15 (`jakarta` classifier) |
| Server | Any Jakarta EE 11 compatible (GlassFish 8, WildFly 34+, Open Liberty 24+, Payara 6.2+) |
| Platform | Jakarta EE 11 (Faces 4.0, CDI 4.0, Servlet 6.0) |
| Java | 21 |
| Build | Maven 3 |
| CSS | Custom properties + `@layer` + native nesting |
| JS | Vanilla ES6 (no framework) |
| Markdown | marked.js (CDN) |

## Features

### Layout
- Fixed topbar with notifications, profile dropdown, theme toggle, AI panel toggle
- Collapsible sidebar with grouped navigation
- Four **menu modes**: Static, Overlay, Slim (icon-only), Horizontal
- Two **menu themes**: Dark, Light
- Status bar (VS Code-style) with AI status indicator
- Fully **RTL-capable** — one toggle flips the entire layout

### Theming
- Three built-in themes: **Light**, **Dark**, **Dim**
- Theme applied via `data-theme` on `<html>` — zero flash on load (inline critical script)
- All colors as CSS custom properties in `layout-variables.css`
- Preferences persisted to `localStorage` and mirrored server-side via `GuestPreferencesBean`

### Command Palette
- `Ctrl+K` / `⌘K` to open
- Keyboard navigation (↑ ↓ Enter), Escape to close
- Search across pages, themes, and actions

### AI Assistant Panel
- Collapsible right panel (280px)
- **Chat UI** with typewriter streaming animation
- **Markdown rendering** via marked.js — headings, lists, code blocks, blockquotes
- **Code block copy** button (hover to reveal, clipboard API)
- **Retry** button on every assistant response
- **Voice input** via Web Speech API (Chrome/Edge; hidden automatically if unsupported)
- AI status dot: idle / thinking / error — reflected in status bar

### Config Panel
- Theme, menu mode, menu theme, form type (outlined/filled), RTL — all live-switching
- Persisted to `localStorage` + `GuestPreferencesBean` session bean
- Full-height slide-in panel (right side, or left in RTL)

### CSS Architecture
```
@layer primefaces, pf-template, app;
```
- `primefaces` layer — lowest priority, never fights component styles
- `pf-template` layer — all template structural CSS
- `app` layer — page-specific overrides win without `!important`
- Native CSS nesting (`&`) throughout — no preprocessor needed
- `primefaces.THEME=none` — PrimeFaces delivers zero theme CSS; everything is hand-crafted

## Project Structure

```
src/main/
├── java/ai/tabforge/pagetemplate/bean/
│   ├── GuestPreferencesBean.java      # Session-scoped preferences
│   └── AiPanelBean.java               # AI panel status bean
└── webapp/
    ├── WEB-INF/
    │   ├── template.xhtml             # Master Facelets template
    │   ├── topbar.xhtml
    │   ├── menu.xhtml
    │   ├── footer.xhtml
    │   ├── config.xhtml               # Config panel (settings drawer)
    │   └── web.xml
    ├── resources/pf-template/
    │   ├── css/
    │   │   ├── layout-variables.css   # All CSS custom properties + theme definitions
    │   │   └── layout.css             # Full structural stylesheet
    │   └── js/
    │       └── layout.js              # PFTemplate JS module (IIFE)
    └── index.xhtml                    # Dashboard page
```

## Getting Started

### Prerequisites
- JDK 21+
- Maven 3.8+
- A Jakarta EE 11 compatible server — GlassFish 8 (RI), WildFly 34+, Open Liberty 24+, or Payara 6.2+

### Build
```bash
mvn clean package
```

### Deploy
Deploy `target/pf-modern-template.war` to any Jakarta EE 11 compatible server, or configure the server in your IDE and run directly.

### Eclipse (WTP)
The project uses Eclipse facets: `java 21`, `jst.web 6.0`, `jst.jsf 4.0`, `jst.cdi 2.0`. Import as an existing Maven project and configure any Jakarta EE 11 runtime (GlassFish 8, WildFly 34+, Open Liberty 24+, Payara 6.2+).

## Using as a Template

### Creating a page
```xml
<ui:composition template="/WEB-INF/template.xhtml"
                xmlns:ui="jakarta.faces.facelets">

    <ui:define name="title">My Page</ui:define>

    <ui:define name="content">
        <!-- your page content here -->
    </ui:define>

    <ui:define name="statusbar-context">My Page</ui:define>

</ui:composition>
```

### Available `ui:insert` slots

| Slot | Purpose |
|------|---------|
| `title` | `<title>` text |
| `head-extra` | Extra `<link>` / `<meta>` in `<head>` |
| `content` | Main page content |
| `statusbar-context` | Left section of status bar |
| `scripts` | Page-specific scripts before `</body>` |

### JavaScript API

The `PFTemplate` global is available on every page once `layout.js` loads:

```javascript
PFTemplate.setTheme('dark')        // light | dark | dim
PFTemplate.toggleAiPanel()         // open / close the AI panel
PFTemplate.palette.open()          // open the command palette
PFTemplate.setMenuLayout('slim')   // static | overlay | slim | horizontal
```

→ Full method reference: [doc/api-reference.md](doc/api-reference.md)

### App-layer CSS override example
```css
@layer app {
    .my-custom-card {
        border-radius: 16px;
        border: 1px solid var(--surface-border);
    }
}
```

## AI Agent Activity Panel

The **Activity tab** is a generic, event-driven observability layer built into the AI panel.
It gives your users a live view of what any agent, workflow, or automation is doing — without
the template knowing anything about the logic behind it.

**What users see:**

- A scrollable timeline of events — each with an icon, color-coded status, title, and timestamp
- Live status transitions: a spinning border turns green (success) or red (error) as events resolve
- Expandable detail rows for tool calls, reasoning steps, and results
- A badge on the Activity tab counting new events since the user last looked
- A **Task Graph** button — opens a visual overlay showing the dependency graph of the current run
- A **Replay** button — replays the entire session at original timing for demos or debugging
- A **Clear** button to reset the timeline between runs

**What your backend does:**

It emits simple JSON events — one per step. The template renders them automatically.
Your backend does not import or depend on the template in any way.

### Event model

```json
{
  "id":        "evt-abc123",
  "timestamp": "2026-05-26T10:15:00.000Z",
  "type":      "tool_call",
  "status":    "running",
  "title":     "Searching CRM",
  "details":   "Finding customer by email",
  "agent":     "SalesAgent",
  "tool":      "crm.search"
}
```

**Built-in event types:** `agent_started`, `agent_finished`, `tool_call`, `tool_result`,
`reasoning`, `browser_action`, `file_operation`, `workflow_step`, `human_input_required`,
`warning`, `error`

**Status values:** `running`, `success`, `error`, `warning`, `waiting`, `queued`, `cancelled`

→ Complete event schema and field reference: [doc/event-reference.md](doc/event-reference.md)

### Connecting a backend

The template supports three connection methods — SSE, WebSocket, and direct JavaScript.
Add this to your page once you have a real backend:

```javascript
// Server-Sent Events (recommended for Jakarta EE)
PFTemplate.AgentTransport.connectSSE('/api/agent/events');
PFTemplate.DemoAgent.enabled = false;   // turns off the built-in demo simulation

// Or WebSocket
PFTemplate.AgentTransport.connectWebSocket('wss://yourserver/agent/ws');
PFTemplate.DemoAgent.enabled = false;
```

→ Full Jakarta EE examples (SSE endpoint, Java agent service, WebSocket): [doc/integration-guide.md](doc/integration-guide.md)

### Plugin API

The template ships with renderers for all built-in event types. The **Plugin API** lets you
add renderers for your own custom event types — controlling the icon, color, and label that
appears in the timeline for each type your backend emits.

Without a plugin, unknown event types fall back to a generic grey dot. With one, your
`crm.lookup` event renders as a purple person icon with the label you define:

```javascript
PFTemplate.registerPlugin({
    id:    'crm-plugin',
    label: 'CRM Plugin',
    renderers: {
        'crm.lookup': function(e) { return { icon: 'pi-users',    color: '#6366f1', label: e.title || 'CRM Lookup' }; },
        'crm.update': function(e) { return { icon: 'pi-pencil',   color: '#6366f1', label: e.title || 'CRM Update' }; },
        'email.send': function(e) { return { icon: 'pi-envelope', color: '#0ea5e9', label: e.title || 'Send Email' }; }
    }
});
```

→ Step-by-step plugin creation guide: [doc/plugin-guide.md](doc/plugin-guide.md)

### Panel configuration

`activityPanel.configure()` lets you tailor the Activity panel to your application — rename
the tab, set the agent label shown in the toolbar, auto-open the panel when events arrive,
and customize the empty-state text shown before any run starts:

```javascript
PFTemplate.activityPanel.configure({
    agentName:     'ETL Pipeline',         // label shown in the Activity tab toolbar
    tabLabel:      'Pipeline',             // replaces the default "Activity" tab name
    autoSwitchTab: true,                   // auto-switches to Activity tab on first event
    emptyTitle:    'No pipeline runs yet',
    emptySubtitle: 'Trigger a run to see live events here.'
});
```

Call `configure()` in your page's `scripts` slot, before any events arrive.

## Multimodal Input

The AI chat input accepts more than text. Users can attach files and images alongside their
messages — by clicking the attach buttons, dragging files onto the input area, or pasting an
image from the clipboard with Ctrl+V.

**What users get:**

- 📎 File picker — images, PDF, DOCX, XLSX, CSV, TXT, LOG
- 🖼 Image picker — images only
- Drag-and-drop onto the chat input
- Ctrl+V clipboard paste (images)
- Attachment chips with image thumbnails and file size
- Validation with instant feedback (20 MB limit, allowed types)

**What your application receives:**

When the user presses Send, the template fires a single `user_message` event on `InputEventBus`:

```javascript
PFTemplate.InputEventBus.on('user_message', function(msg) {
    // msg.text        — typed message (string, may be empty)
    // msg.attachments — serializable metadata [{ id, type, mimeType, name, size }]
    // msg.files       — native File objects [{ id, file }] — usable with FormData + fetch
    // msg.timestamp   — ISO 8601 string
});
```

The template collects the input. Your application decides what to do with it.

→ Full integration guide with worked examples: [doc/multimodal-input-guide.md](doc/multimodal-input-guide.md)

## Roadmap

- [x] Phase 1 — Layout structure (topbar, sidebar, main, footer, status bar)
- [x] Phase 2 — Theme system (light/dark/dim, menu modes, RTL)
- [x] Phase 3 — Command palette, config panel
- [x] Phase 4 — AI Assistant Panel (chat, markdown, voice input, retry)
- [x] Phase 5 — AI Agent Activity Panel (generic event stream, timeline UI, task graph, replay, plugin API)
- [x] Phase 5b — Multimodal Input (drag-drop, clipboard paste, file/image picker, InputEventBus)
- [ ] Phase 6 — Demo pages (dashboard, login, error, 404)

## License

Apache 2.0 — see [LICENSE](LICENSE)
