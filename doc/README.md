# PF Modern Template — Documentation

## Contents

| Document | Description |
|----------|-------------|
| [Event Reference](event-reference.md) | Complete event model — all fields, types, and status values |
| [Integration Guide](integration-guide.md) | How to connect a real backend (SSE, WebSocket, direct JS) |
| [Plugin Guide](plugin-guide.md) | Creating and registering custom event type plugins |
| [API Reference](api-reference.md) | Full JavaScript public API |

## Architecture Overview

The AI Agent Activity Panel is a **generic, event-driven observability layer**. The template knows nothing about the AI framework or business logic behind it. Any backend emits JSON events; the template receives, renders, and groups them.

```
┌─────────────────────────────────────────────────────┐
│  Your Backend                                       │
│  (LangChain / Java agent / workflow engine / RAG)   │
│                                                     │
│  emits JSON events ──────────────────────────────── │
└──────────────────────────────┬──────────────────────┘
                               │  SSE / WebSocket / direct JS
                               ▼
┌─────────────────────────────────────────────────────┐
│  PF Modern Template                                 │
│                                                     │
│  AgentTransport → AgentEventBus → RendererRegistry  │
│                        │                            │
│                        ▼                            │
│           Activity Panel Timeline UI                │
└─────────────────────────────────────────────────────┘
```

The template never imports or depends on any AI library. It only speaks the **PF Agent Event format** — a simple JSON schema documented in [Event Reference](event-reference.md).
