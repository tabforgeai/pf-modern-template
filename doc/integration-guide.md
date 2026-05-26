# Integration Guide

This guide shows how to connect a real backend to the Activity Panel, replacing the built-in demo simulation.

---

## The Generic Flow

This is the core pattern from the architecture plan. Your backend emits two events; the template renders them with no knowledge of what "database.search" means.

**Step 1 — backend emits:**
```json
{
  "id":        "search-1",
  "type":      "tool_call",
  "tool":      "database.search",
  "status":    "running",
  "title":     "Searching database",
  "agent":     "MyAgent",
  "timestamp": "2026-05-26T10:15:00.000Z"
}
```

**Template renders:**
```
⟳  Searching database          10:15:00
   ↳ [expand for details]
```
The row shows a spinning blue border — agent is working.

**Step 2 — backend emits:**
```json
{
  "id":        "search-2",
  "type":      "tool_result",
  "tool":      "database.search",
  "status":    "success",
  "title":     "Search completed",
  "details":   "12 records found",
  "agent":     "MyAgent",
  "timestamp": "2026-05-26T10:15:01.200Z"
}
```

**Template renders:**
```
✓  Search completed             10:15:01
   12 records found
```
Green icon. No knowledge of databases, SQL, or agent logic — just JSON → UI.

**Alternative: single row that updates in place**

Instead of a separate `tool_result`, update the original row:

```json
// Backend calls updateEvent endpoint, or JS does:
PFTemplate.activityPanel.updateEvent('search-1', 'success', 'Search completed');
```

The spinner stops, border turns green, label updates — same row.

---

## Step 1: Disable Demo Simulation

Add this to your page script once you wire a real backend:

```javascript
PFTemplate.DemoAgent.enabled = false;
```

Or remove the `DemoAgent.simulate(text)` call from your page entirely.

---

## Option A: Server-Sent Events (Jakarta EE / Java)

SSE is the recommended transport for Jakarta EE — it uses a standard `@GET` endpoint, works through proxies, and auto-reconnects on the client side.

### Jakarta EE SSE Endpoint

```java
import jakarta.ws.rs.*;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.sse.*;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import jakarta.annotation.PostConstruct;

@Path("/api/agent/stream")
@ApplicationScoped
public class AgentStreamResource {

    @Inject
    private Sse sse;

    private SseBroadcaster broadcaster;

    @PostConstruct
    public void init() {
        broadcaster = sse.newBroadcaster();
    }

    @GET
    @Produces(MediaType.SERVER_SENT_EVENTS)
    public void subscribe(@Context SseEventSink sink) {
        broadcaster.register(sink);
    }

    // Call this from your agent/service to push an event
    public void emit(String eventJson) {
        broadcaster.broadcast(sse.newEvent(eventJson));
    }
}
```

### Agent Service (example)

```java
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import jakarta.json.Json;
import java.time.Instant;
import java.util.UUID;

@ApplicationScoped
public class MyAgentService {

    @Inject
    private AgentStreamResource stream;

    public void runDatabaseSearch(String query) {
        String id = UUID.randomUUID().toString();

        // Emit: tool starting
        stream.emit(Json.createObjectBuilder()
            .add("id",        id)
            .add("timestamp", Instant.now().toString())
            .add("type",      "tool_call")
            .add("status",    "running")
            .add("title",     "Searching database")
            .add("tool",      "database.search")
            .add("details",   "Query: " + query)
            .add("agent",     "MyAgent")
            .build().toString());

        // ... do the actual work ...
        var results = database.search(query);

        // Emit: tool result
        stream.emit(Json.createObjectBuilder()
            .add("id",        UUID.randomUUID().toString())
            .add("timestamp", Instant.now().toString())
            .add("type",      "tool_result")
            .add("status",    "success")
            .add("title",     "Search completed")
            .add("tool",      "database.search")
            .add("details",   results.size() + " records found")
            .add("agent",     "MyAgent")
            .build().toString());
    }
}
```

### Frontend wiring (in your XHTML page or template)

```javascript
// Connect once on page load — auto-reconnects on disconnect
PFTemplate.AgentTransport.connectSSE('/api/agent/stream');

// Disable demo
PFTemplate.DemoAgent.enabled = false;

// Optional: configure the panel
PFTemplate.activityPanel.configure({
    agentName:     'MyAgent',
    autoSwitchTab: true   // auto-open Activity tab when events arrive
});
```

### web.xml — enable JAX-RS (if not already)

```xml
<servlet>
    <servlet-name>Jakarta REST</servlet-name>
    <servlet-class>jakarta.ws.rs.core.Application</servlet-class>
</servlet>
<servlet-mapping>
    <servlet-name>Jakarta REST</servlet-name>
    <url-pattern>/api/*</url-pattern>
</servlet-mapping>
```

---

## Option B: WebSocket (Jakarta EE)

```java
import jakarta.websocket.*;
import jakarta.websocket.server.ServerEndpoint;
import java.util.Set;
import java.util.concurrent.CopyOnWriteArraySet;

@ServerEndpoint("/ws/agent")
@ApplicationScoped
public class AgentWebSocketEndpoint {

    private static final Set<Session> sessions = new CopyOnWriteArraySet<>();

    @OnOpen
    public void onOpen(Session session) {
        sessions.add(session);
    }

    @OnClose
    public void onClose(Session session) {
        sessions.remove(session);
    }

    public void broadcast(String eventJson) {
        sessions.forEach(s -> {
            if (s.isOpen()) s.getAsyncRemote().sendText(eventJson);
        });
    }
}
```

```javascript
// Frontend
PFTemplate.AgentTransport.connectWebSocket('wss://yourhost/ws/agent');
PFTemplate.DemoAgent.enabled = false;
```

---

## Option C: Emit directly from JavaScript

No backend connection needed — any JavaScript on the page can emit events:

```javascript
function runMyWorkflow() {
    const agentId = 'workflow-' + Date.now();

    PFTemplate.AgentEventBus.emit({
        id:        agentId + '-start',
        timestamp: new Date().toISOString(),
        type:      'agent_started',
        status:    'running',
        title:     'Starting workflow',
        agent:     'WorkflowEngine'
    });

    // ... do work ...

    PFTemplate.AgentEventBus.emit({
        id:        agentId + '-end',
        timestamp: new Date().toISOString(),
        type:      'agent_finished',
        status:    'success',
        title:     'Workflow completed',
        agent:     'WorkflowEngine'
    });
}
```

---

## Full end-to-end example

This is the minimal complete flow — one agent run with three events.

**Backend emits (in order):**

```json
{"id":"1","type":"agent_started","status":"running","title":"Processing order #4521","agent":"OrderAgent","timestamp":"..."}
{"id":"2","type":"tool_call","tool":"database.search","status":"running","title":"Looking up inventory","agent":"OrderAgent","timestamp":"..."}
{"id":"3","type":"tool_result","tool":"database.search","status":"success","title":"Inventory found","details":"Stock: 42 units","agent":"OrderAgent","timestamp":"..."}
{"id":"4","type":"tool_call","tool":"email.send","status":"running","title":"Sending confirmation","agent":"OrderAgent","timestamp":"..."}
{"id":"5","type":"tool_result","tool":"email.send","status":"success","title":"Email sent","details":"To: customer@example.com","agent":"OrderAgent","timestamp":"..."}
{"id":"6","type":"agent_finished","status":"success","title":"Order processed","agent":"OrderAgent","timestamp":"..."}
```

**Template renders — Activity tab shows:**
```
✦ Processing order #4521                    [success]
⟳→✓ Looking up inventory                   [success]
   Stock: 42 units
✓ Inventory found                           [success]
⟳→✓ Sending confirmation                   [success]
✓ Email sent                                [success]
   To: customer@example.com
✓ Order processed                           [success]
```

**Template knows nothing about:** orders, inventory, email providers, or OrderAgent internals.  
**Template knows:** how to render 6 JSON events with icons, colors, and animations.

---

## Reconnect configuration

```javascript
// Custom reconnect delay (default: 3000ms)
PFTemplate.AgentTransport.connectSSE('/api/agent/stream', {
    reconnectDelay: 5000
});

PFTemplate.AgentTransport.connectWebSocket('wss://host/ws/agent', {
    reconnectDelay: 2000
});

// Disconnect manually
PFTemplate.AgentTransport.disconnect();
```
