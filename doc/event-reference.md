# Event Reference

## Event Schema

Every event is a JSON object. Only `type` is required — all other fields are optional but recommended.

```json
{
  "id":        "evt-abc123",
  "timestamp": "2026-05-26T10:15:00.000Z",
  "type":      "tool_call",
  "status":    "running",
  "title":     "Searching CRM",
  "details":   "Finding customer by email: john@example.com",
  "agent":     "SalesAgent",
  "tool":      "crm.search"
}
```

### Fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `type` | string | **yes** | Event type — determines icon, color, and default label |
| `id` | string | recommended | Unique ID used by `updateEvent()` and replay |
| `timestamp` | ISO 8601 string | recommended | Event time; used in collapsible details and replay timing |
| `status` | string | recommended | See [Status Values](#status-values) |
| `title` | string | recommended | Primary label shown in the timeline row |
| `details` | string | optional | Secondary line shown in timeline row and expanded details |
| `agent` | string | optional | Agent name shown in the toolbar |
| `tool` | string | optional | Tool name — used for tool-specific icons on `tool_call`/`tool_result` |

---

## Event Types

### Core lifecycle

| Type | Default icon | Default label | Typical status |
|------|-------------|---------------|----------------|
| `agent_started` | ✦ sparkles | Agent started | `running` |
| `agent_finished` | ✓ check-circle | Agent finished | `success` |
| `reasoning` | ⊞ th-large | Reasoning | `running` → `success` |

### Tool interaction

| Type | Default icon | Default label | Notes |
|------|-------------|---------------|-------|
| `tool_call` | *(tool-dependent)* | Tool name or title | Icon chosen by `tool` field value |
| `tool_result` | *(tool-dependent)* | Result received | Usually `success` or `error` |

Tool icons are resolved from the `tool` field by keyword:

| Keyword in `tool` | Icon |
|-------------------|------|
| `browser`, `web`, `http` | 🌐 globe |
| `database`, `db`, `sql` | 🗄 database |
| `file`, `doc`, `pdf` | 📄 file |
| `email`, `mail` | ✉ envelope |
| `terminal`, `shell`, `exec` | 💻 terminal |
| `search`, `find` | 🔍 search |
| `code`, `function`, `script` | </> code |
| `api`, `rest` | ☁ cloud |
| *(anything else)* | ⚙ cog |

### Infrastructure & flow

| Type | Default icon | Default label |
|------|-------------|---------------|
| `browser_action` | 🌐 globe | Browser action |
| `file_operation` | 📄 file | File operation |
| `workflow_step` | ⎇ sitemap | Workflow step |
| `human_input_required` | 👤 user | Input required |

### Signals

| Type | Default icon | Color | Default label |
|------|-------------|-------|---------------|
| `warning` | ⚠ exclamation-triangle | amber | Warning |
| `error` | ✕ times-circle | red | Error |

---

## Status Values

Status drives the visual appearance of the timeline row icon.

| Status | Visual | Border color |
|--------|--------|--------------|
| `running` | Spinning border animation | primary (blue/violet) |
| `success` | Solid icon, filled background | green |
| `error` | Solid icon, filled background | red |
| `warning` | Solid icon, filled background | amber |
| `waiting` | Muted, low opacity | secondary |
| `queued` | Normal | border color |
| `cancelled` | Normal | border color |

---

## Updating an event

When a `running` event resolves, call `updateEvent()` instead of emitting a new row. This changes the existing row in place — spinning stops, icon turns green (or red).

```javascript
// Emit running event
PFTemplate.AgentEventBus.emit({
    id: 'search-1',
    type: 'tool_call',
    status: 'running',
    title: 'Searching database',
    tool: 'database.search'
});

// Later, when done — update the same row
PFTemplate.activityPanel.updateEvent('search-1', 'success', 'Search completed');
```

vs. emitting a separate `tool_result` event (two rows):

```javascript
PFTemplate.AgentEventBus.emit({ id: 'result-1', type: 'tool_result', status: 'success', title: 'Search completed', tool: 'database.search', details: '12 records found' });
```

Both approaches are valid. Use `updateEvent()` for a cleaner timeline; use two events when the result carries meaningful different data.
