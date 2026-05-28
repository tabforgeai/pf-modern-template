# JavaScript API Reference

All public APIs are exposed on the `PFTemplate` global object.

---

## AgentEventBus

The central pub/sub bus. Everything flows through here.

### `AgentEventBus.emit(event)`

Dispatches an event to all registered listeners (including the Activity Panel).

```javascript
PFTemplate.AgentEventBus.emit({
    id:        'evt-001',
    timestamp: new Date().toISOString(),
    type:      'tool_call',
    status:    'running',
    title:     'Searching database',
    tool:      'database.search',
    agent:     'MyAgent'
});
```

### `AgentEventBus.on(type, fn)`

Listens for events of a specific type. Use `'*'` to listen to all events.

```javascript
PFTemplate.AgentEventBus.on('agent_finished', (event) => {
    console.log('Agent done:', event.agent);
});

PFTemplate.AgentEventBus.on('*', (event) => {
    console.log('Any event:', event.type, event.status);
});
```

### `AgentEventBus.clear()`

Removes all listeners. Use with caution — also removes the Activity Panel listener.

---

## AgentTransport

Connects the event bus to a remote backend.

### `AgentTransport.connectSSE(url, opts?)`

Opens a Server-Sent Events connection. Auto-reconnects on disconnect.

```javascript
PFTemplate.AgentTransport.connectSSE('/api/agent/stream');

// With options
PFTemplate.AgentTransport.connectSSE('/api/agent/stream', {
    reconnectDelay: 5000  // ms between reconnect attempts (default: 3000)
});
```

The backend must send JSON events as SSE `data:` messages:
```
data: {"type":"tool_call","status":"running",...}
```

### `AgentTransport.connectWebSocket(url, opts?)`

Opens a WebSocket connection. Auto-reconnects on close.

```javascript
PFTemplate.AgentTransport.connectWebSocket('wss://host/ws/agent');
```

The backend must send JSON event strings as WebSocket text messages.

### `AgentTransport.disconnect()`

Closes all open connections and prevents reconnect.

```javascript
PFTemplate.AgentTransport.disconnect();
```

---

## activityPanel

Controls the Activity tab UI.

### `activityPanel.configure(opts)`

Configures the panel. Chainable.

```javascript
PFTemplate.activityPanel.configure({
    agentName:     'ETL Pipeline',   // label shown in activity toolbar
    tabLabel:      'Pipeline',       // renames the "Activity" tab button
    autoSwitchTab: true,             // auto-open Activity tab + AI panel on first event
    emptyTitle:    'No runs yet',    // empty state heading
    emptySubtitle: 'Trigger a run to see events here.'
});
```

### `activityPanel.updateEvent(id, status, titleOverride?)`

Updates an existing timeline row in place. Used to transition a `running` event to `success` or `error`.

```javascript
// Change status and optionally update the label
PFTemplate.activityPanel.updateEvent('evt-001', 'success', 'Search completed');
PFTemplate.activityPanel.updateEvent('evt-002', 'error',   'Connection failed');
```

### `activityPanel.clear()`

Clears all timeline rows and event history.

### `activityPanel.replay()`

Re-renders all events from history with their original relative timing. Shows spinner animations for `running` events again.

```javascript
PFTemplate.activityPanel.replay();
```

### `activityPanel.showGraph()`

Opens the Task Graph overlay — a visual flowchart of all events in the current session.

```javascript
PFTemplate.activityPanel.showGraph();
```

### `activityPanel.closeGraph()`

Closes the Task Graph overlay.

---

## RendererRegistry

Maps event types to visual descriptors.

### `RendererRegistry.register(type, fn)`

Registers a renderer function for a given event type.

```javascript
PFTemplate.RendererRegistry.register('my.event', (event) => ({
    icon:  'pi-cog',
    color: '#6366f1',
    label: event.title || 'My Event'
}));
```

The renderer function receives the full event object and must return:

```javascript
{
    icon:  string,   // PrimeIcons class name (without the 'pi ' prefix)
    color: string,   // CSS color value
    label: string    // text shown in the timeline row
}
```

---

## PluginRegistry

### `registerPlugin(descriptor)` / `PluginRegistry.register(descriptor)`

Registers a plugin — registers all its renderers at once.

```javascript
PFTemplate.registerPlugin({
    id:    'my-plugin',          // required, unique
    label: 'My Plugin',          // optional, human-readable
    renderers: {
        'my.type.a': (e) => ({ icon: 'pi-check', color: '#22c55e', label: e.title }),
        'my.type.b': (e) => ({ icon: 'pi-times', color: '#ef4444', label: e.title }),
    }
});
```

### `PluginRegistry.list()`

Returns an array of registered plugin descriptors.

```javascript
PFTemplate.PluginRegistry.list();
// → [{ id: 'my-plugin', label: 'My Plugin' }]
```

---

## DemoAgent

Simulates agent activity for development and demo purposes.

### `DemoAgent.enabled`

Set to `false` when connecting a real backend.

```javascript
PFTemplate.DemoAgent.enabled = false;
```

### `DemoAgent.simulate(userText)`

Fires a sequence of demo events based on the user text. Called automatically from the chat panel when `enabled` is true.

```javascript
PFTemplate.DemoAgent.simulate('search for customer data');
```

---

## aiPanel

Controls the Chat tab.

### `aiPanel.switchTab(tab)`

Switches the active tab. `tab` is `'chat'` or `'activity'`.

```javascript
PFTemplate.aiPanel.switchTab('activity');
```

### `aiPanel.send()`

Programmatically sends the current textarea value as a chat message.

---

## OutputActionRegistry

### `registerOutputAction(def)` / `OutputActionRegistry.register(def)`

Registers a custom button in the action toolbar shown below every AI response.

```javascript
PFTemplate.registerOutputAction({
    type:    'translate',       // unique ID — not shown to user
    icon:    'pi-language',     // PrimeIcons class without the 'pi ' prefix
    title:   'Translate',       // button label and tooltip
    handler: function(text, msgEl) {
        // text   — plain-text content of the AI response (no HTML, no markdown syntax)
        // msgEl  — the .ai-message-assistant wrapper element for this response
        myApp.translate(text);
    }
});
```

Buttons appear on every **new** response after registration, to the right of the built-in
Retry and Copy buttons. Responses already rendered on screen are not affected.

### `OutputActionRegistry.getAll()`

Returns a snapshot of all registered action definitions. Primarily used internally by the
toolbar builder, but available for inspection.

```javascript
PFTemplate.OutputActionRegistry.getAll();
// → [{ type, icon, title, handler }, ...]
```

---

## TtsPlayer

Controls the built-in TTS audio player bar.

### `TtsPlayer.register(fn)`

Registers an async TTS provider function. Once called, every new AI response gains a
**Speak** button in the action toolbar.

```javascript
PFTemplate.TtsPlayer.register(async function(text) {
    var resp = await fetch('/api/tts', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ text: text })
    });
    return await resp.blob();     // Blob (MP3, WAV, OGG) — or return a URL string
});
```

When the user clicks Speak, the template:
1. Shows a loading spinner while the function runs
2. Receives the Blob or URL
3. Renders a compact player bar: `▶/⏸ · progress · 0:08 / 0:45 · ×`
4. Starts playback automatically

If the function throws, the spinner disappears silently.

Only one message plays at a time — clicking Speak on a second message stops the first.

→ Step-by-step guide with Jakarta EE backend examples: [output-actions-guide.md](output-actions-guide.md)

---

## Layout helpers

```javascript
PFTemplate.setTheme('dark')              // 'light' | 'dark' | 'dim'
PFTemplate.setMenuLayout('overlay')      // 'static' | 'overlay' | 'slim' | 'horizontal'
PFTemplate.setMenuTheme('light')         // 'dark' | 'light'
PFTemplate.setInputStyle('filled')       // 'outlined' | 'filled'
PFTemplate.setRtl(true)                  // boolean
PFTemplate.toggleMenu()                  // open/close sidebar
PFTemplate.toggleAiPanel()              // open/close AI panel
PFTemplate.openConfig()                 // open settings panel
PFTemplate.palette.open()               // open command palette (Ctrl+K)
```
