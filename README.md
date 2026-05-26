# PF Modern Template

A modern, production-ready application template built on **PrimeFaces 15**, **Jakarta EE 11**, and **Java 21**. Designed as a zero-dependency UI shell that any enterprise Java application can drop into — with a fully custom CSS architecture, AI assistant panel, and a built-in generic AI agent activity system.

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
```javascript
PFTemplate.setTheme('dark')           // light | dark | dim
PFTemplate.setMenuLayout('overlay')   // static | overlay | slim | horizontal
PFTemplate.setMenuTheme('light')      // dark | light
PFTemplate.setInputStyle('filled')    // outlined | filled
PFTemplate.setRtl(true)
PFTemplate.toggleAiPanel()
PFTemplate.openConfig()
PFTemplate.palette.open()
```

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

The Activity tab is a **generic, event-driven observability layer**. The template knows nothing about AI logic — it only receives, renders, and groups events. Any backend (LangChain, custom Java agent, workflow engine, RAG pipeline) connects by emitting JSON events.

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

**Built-in event types:** `agent_started`, `agent_finished`, `tool_call`, `tool_result`, `reasoning`, `browser_action`, `file_operation`, `workflow_step`, `human_input_required`, `warning`, `error`

**Status values:** `running`, `success`, `error`, `warning`, `waiting`, `queued`, `cancelled`

### Connecting a real backend

**Option A — Server-Sent Events (Jakarta / Java)**

```java
// Jakarta EE SSE endpoint
@Path("/agent/events")
public class AgentEventResource {
    @GET
    @Produces(MediaType.SERVER_SENT_EVENTS)
    public void stream(@Context SseEventSink sink, @Context Sse sse) {
        // emit events as agent runs
        sink.send(sse.newEvent(Json.createObjectBuilder()
            .add("id",        UUID.randomUUID().toString())
            .add("timestamp", Instant.now().toString())
            .add("type",      "tool_call")
            .add("status",    "running")
            .add("title",     "Searching database")
            .add("agent",     "MyAgent")
            .build().toString()));
    }
}
```

```javascript
// In your page script — connects and auto-reconnects
PFTemplate.AgentTransport.connectSSE('/api/agent/events');

// Disable demo simulation when using real backend
PFTemplate.DemoAgent.enabled = false;
```

**Option B — WebSocket**

```javascript
PFTemplate.AgentTransport.connectWebSocket('wss://yourserver/agent/ws');
PFTemplate.DemoAgent.enabled = false;
```

**Option C — Emit directly from JavaScript**

```javascript
PFTemplate.AgentEventBus.emit({
    id:        'evt-' + Date.now(),
    timestamp: new Date().toISOString(),
    type:      'tool_call',
    status:    'running',
    title:     'Calling external API',
    agent:     'MyAgent',
    tool:      'http.get'
});
```

### Plugin API

Register custom event types — icons, colors, labels:

```javascript
PFTemplate.registerPlugin({
    id:    'crm-plugin',
    label: 'CRM Plugin',
    renderers: {
        'crm.lookup': (e) => ({ icon: 'pi-users',   color: '#6366f1', label: e.title || 'CRM Lookup'  }),
        'crm.update': (e) => ({ icon: 'pi-pencil',  color: '#6366f1', label: e.title || 'CRM Update'  }),
        'email.send': (e) => ({ icon: 'pi-envelope', color: '#0ea5e9', label: e.title || 'Send Email'  }),
    }
});
```

### Panel configuration

```javascript
PFTemplate.activityPanel.configure({
    agentName:     'ETL Pipeline',       // agent label shown in toolbar
    tabLabel:      'Pipeline',           // renames "Activity" tab
    autoSwitchTab: true,                 // auto-open Activity tab on first event
    emptyTitle:    'No pipeline runs',
    emptySubtitle: 'Trigger a run to see events here.'
});
```

## Roadmap

- [x] Phase 1 — Layout structure (topbar, sidebar, main, footer, status bar)
- [x] Phase 2 — Theme system (light/dark/dim, menu modes, RTL)
- [x] Phase 3 — Command palette, config panel
- [x] Phase 4 — AI Assistant Panel (chat, markdown, voice input, retry)
- [ ] Phase 5 — AI Agent Activity Panel (generic event stream, timeline UI, renderer registry)
- [ ] Phase 6 — Demo pages (dashboard, login, error, 404)

## License

Apache 2.0 — see [LICENSE](LICENSE)
