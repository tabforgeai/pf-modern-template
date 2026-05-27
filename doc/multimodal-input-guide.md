# Multimodal Input — Integration Guide

This guide explains what you get with the Multimodal Input layer and what your application needs
to do to receive and act on user messages — text, files, and images.

---

## What the template gives you out of the box

When a user types a message and/or attaches files, the template handles the entire input experience:

| Feature | What happens |
|---------|-------------|
| **File picker** (📎) | Opens a native file chooser; accepts images, PDF, DOCX, XLSX, CSV, TXT, LOG |
| **Image picker** (🖼) | Same, filtered to images only |
| **Drag-and-drop** | User drags files from desktop onto the chat input area |
| **Clipboard paste** | User presses Ctrl+V with an image in the clipboard |
| **Attachment chips** | Files appear as chips with a thumbnail (images) or icon + filename + size |
| **Validation** | 20 MB limit, allowed MIME types — rejected files show an error chip |
| **Send** | Pressing Enter or the send button fires one `user_message` event to your application |

Your application receives a single JavaScript event. Everything else is handled by the template.

---

## The event you receive

When the user sends a message, the template fires:

```javascript
{
  type:        "user_message",
  text:        "Summarize this report",
  timestamp:   "2026-05-27T10:03:19.925Z",

  // Serializable metadata — safe for JSON.stringify, REST, SSE
  attachments: [
    {
      id:       "att-0",
      type:     "pdf",
      mimeType: "application/pdf",
      name:     "quarterly-report.pdf",
      size:     245120
    }
  ],

  // Native File objects — available for upload via fetch + FormData
  // (not JSON-serializable; do not store past the synchronous callback or copy them before async work)
  files: [
    { id: "att-0", file: File }
  ]
}
```

`attachments` and `files` use matching `id` values so you can correlate metadata with the raw bytes.

---

## Step 1 — Register your handler

Place this in your page's `<ui:insert name="scripts">` block, or in a page-specific JS file
loaded after `layout.js`:

```javascript
PFTemplate.InputEventBus.on('user_message', function(msg) {
    var text        = msg.text;          // the typed text (may be empty string)
    var attachments = msg.attachments;   // metadata array (always present, may be empty)
    var files       = msg.files;         // File objects (same length as attachments)
    var timestamp   = msg.timestamp;     // ISO 8601 string

    // your application logic here
});
```

---

## Step 2 — Disable demo simulation

The template ships with `DemoAgent` — a built-in simulation that streams fake AI responses
and fires fake activity events so the panel looks alive without a real backend.
Turn it off once you wire a real backend:

```javascript
PFTemplate.DemoAgent.enabled = false;
```

Add this on the same page where you register your `InputEventBus` handler.

---

## Example 1 — Plain text chat with a JAX-RS backend

### Scenario

The user types questions in the AI panel. Your backend processes them and returns answers.
No file attachments involved.

### Backend: JAX-RS endpoint

```java
import jakarta.ws.rs.*;
import jakarta.ws.rs.core.*;
import jakarta.enterprise.context.RequestScoped;

/**
 * Receives a plain-text chat message and returns an AI-generated reply.
 * The template POSTs { text, timestamp } as JSON; this endpoint returns the reply as plain text.
 *
 * @param body — JSON object with 'text' (string) and 'timestamp' (ISO string).
 * @returns plain text reply, streamed or returned in one chunk.
 */
@Path("/api/chat")
@RequestScoped
public class ChatResource {

    @Inject
    private MyAIService aiService;

    @POST
    @Consumes(MediaType.APPLICATION_JSON)
    @Produces(MediaType.TEXT_PLAIN)
    public Response chat(ChatRequest body) {
        String reply = aiService.answer(body.getText());
        return Response.ok(reply).build();
    }
}
```

```java
public class ChatRequest {
    private String text;
    private String timestamp;
    // getters + setters
}
```

### Frontend wiring (in your XHTML page)

```javascript
PFTemplate.DemoAgent.enabled = false;

PFTemplate.InputEventBus.on('user_message', function(msg) {
    if (!msg.text) return;  // no text — ignore, or handle attachments separately

    // Show "thinking" in the status bar
    PFTemplate.setAiStatus('Thinking…');

    fetch('/myapp/api/chat', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ text: msg.text, timestamp: msg.timestamp })
    })
    .then(function(res) { return res.text(); })
    .then(function(reply) {
        // Push the reply into the AI panel as an assistant message
        PFTemplate.aiPanel.appendAssistant(reply);
        PFTemplate.setAiStatus('AI ready');
    })
    .catch(function(err) {
        PFTemplate.aiPanel.appendAssistant('Sorry, something went wrong.');
        PFTemplate.setAiStatus('AI error');
    });
});
```

### What the user sees

```
You:        What is the status of order #1234?
Assistant:  Order #1234 was shipped on 2026-05-25 and is expected to arrive by May 29.
```

---

## Example 2 — Document analysis (PDF + question)

### Scenario

The user attaches a PDF and types "Summarize the key findings". Your backend uploads
the file to an AI service (e.g. Claude, GPT-4) and returns a summary.

### Backend: multipart endpoint

```java
import jakarta.ws.rs.*;
import jakarta.ws.rs.core.*;
import org.jboss.resteasy.annotations.providers.multipart.MultipartForm;

/**
 * Accepts a document file and an optional user question, passes them to the AI service,
 * and returns the analysis as plain text.
 *
 * @param form — multipart form with fields 'file' (binary) and 'question' (string).
 * @returns AI-generated analysis as plain text.
 */
@Path("/api/analyze")
@RequestScoped
public class DocumentAnalysisResource {

    @Inject
    private MyAIService aiService;

    @POST
    @Consumes(MediaType.MULTIPART_FORM_DATA)
    @Produces(MediaType.TEXT_PLAIN)
    public Response analyze(@MultipartForm DocumentForm form) {
        String result = aiService.analyzeDocument(form.getFile(), form.getFileName(), form.getQuestion());
        return Response.ok(result).build();
    }
}
```

```java
public class DocumentForm {
    @FormParam("file")      private byte[] file;
    @FormParam("filename")  private String fileName;
    @FormParam("question")  private String question;
    // getters + setters
}
```

### Frontend wiring

```javascript
PFTemplate.DemoAgent.enabled = false;

PFTemplate.InputEventBus.on('user_message', function(msg) {
    var hasDocs = msg.attachments.some(function(a) {
        return a.type === 'pdf' || a.type === 'document' || a.type === 'spreadsheet';
    });

    if (!hasDocs) {
        // No document — fall through to plain text handler
        handleTextOnly(msg.text);
        return;
    }

    PFTemplate.setAiStatus('Uploading and analyzing…');

    // Process each document attachment
    msg.files.forEach(function(f, index) {
        var meta = msg.attachments[index];

        var formData = new FormData();
        formData.append('file',     f.file);           // native File object
        formData.append('filename', meta.name);
        formData.append('question', msg.text || 'Summarize this document.');

        fetch('/myapp/api/analyze', {
            method: 'POST',
            body:   formData
        })
        .then(function(res) { return res.text(); })
        .then(function(reply) {
            PFTemplate.aiPanel.appendAssistant('**' + meta.name + '**\n\n' + reply);
            PFTemplate.setAiStatus('AI ready');
        })
        .catch(function() {
            PFTemplate.aiPanel.appendAssistant('Could not analyze ' + meta.name + '.');
            PFTemplate.setAiStatus('AI error');
        });
    });
});
```

### What the user sees

```
You:        [📄 quarterly-report.pdf]  Summarize the key findings.
Assistant:  **quarterly-report.pdf**

            Revenue grew 12 % YoY. Operating margin improved to 18 %. Three risks
            flagged: supply chain exposure, FX headwinds, and rising logistics costs.
```

---

## Attachment metadata reference

Each item in `event.attachments[]`:

| Field | Type | Description |
|-------|------|-------------|
| `id` | string | Unique per-session ID (`"att-0"`, `"att-1"`, …). Matches `event.files[n].id`. |
| `type` | string | Category — see table below |
| `mimeType` | string | Original browser MIME type (e.g. `"application/pdf"`) |
| `name` | string | Original filename |
| `size` | number | File size in bytes |

### `type` categories

| Value | Covers |
|-------|--------|
| `image` | `image/*` |
| `pdf` | `application/pdf` |
| `spreadsheet` | `.xlsx`, `.csv` (`spreadsheetml`, `ms-excel`, `csv`) |
| `document` | `.docx` (`wordprocessingml`, `msword`) |
| `audio` | `audio/*` |
| `text` | `text/plain`, `.log` |
| `other` | Anything else |

Each item in `event.files[]`:

| Field | Type | Description |
|-------|------|-------------|
| `id` | string | Same ID as the matching `attachments` entry |
| `file` | `File` | Native browser `File` object — usable directly with `FormData` and `fetch` |

> **Note:** `File` objects are not JSON-serializable. Do not pass them to `JSON.stringify` or
> include them in SSE / WebSocket messages. Extract the bytes you need during or immediately after
> the `user_message` callback before they are garbage-collected.

---

## Customizing validation

The built-in limits can be overridden from your page script before the first file is selected:

```javascript
// Raise the size limit to 50 MB
PFTemplate.MultimodalInput.MAX_SIZE_BYTES = 50 * 1024 * 1024;

// Allow only images and PDFs
PFTemplate.MultimodalInput.ALLOWED_TYPES = ['image/', 'application/pdf'];
```

`ALLOWED_TYPES` is an array of MIME prefix strings — a file is accepted if its MIME type
starts with any entry in the list.

---

## Checking what was attached

You can read the current pending attachments at any time before the user presses Send:

```javascript
var pending = PFTemplate.MultimodalInput.getAttachments();
// returns [{ id, type, mimeType, name, size }, ...]
```

---

## Handling text-only vs. attachment-only messages

```javascript
PFTemplate.InputEventBus.on('user_message', function(msg) {
    var hasText  = msg.text.length > 0;
    var hasFiles = msg.attachments.length > 0;

    if (hasText && !hasFiles) {
        // Pure text chat message
        sendToTextAI(msg.text);

    } else if (hasFiles && !hasText) {
        // Files dropped with no message — prompt the user or use a default question
        analyzeFiles(msg.files, 'Describe the contents of this file.');

    } else if (hasText && hasFiles) {
        // Text + files — typical document Q&A pattern
        analyzeFiles(msg.files, msg.text);
    }
});
```

---

## Showing progress in the Activity tab

While your backend processes an upload, emit events to the Activity tab so the user
can see what is happening:

```javascript
PFTemplate.InputEventBus.on('user_message', function(msg) {
    if (!msg.files.length) return;

    var runId = 'upload-' + Date.now();

    // Show "uploading" in the Activity tab
    PFTemplate.AgentEventBus.emit({
        id:        runId + '-upload',
        type:      'tool_call',
        tool:      'file.upload',
        status:    'running',
        title:     'Uploading ' + msg.attachments[0].name,
        agent:     'DocumentAgent',
        timestamp: new Date().toISOString()
    });

    var formData = new FormData();
    formData.append('file', msg.files[0].file);
    formData.append('question', msg.text);

    fetch('/myapp/api/analyze', { method: 'POST', body: formData })
    .then(function(res) { return res.text(); })
    .then(function(reply) {
        // Update Activity tab: upload succeeded
        PFTemplate.AgentEventBus.emit({
            id:        runId + '-done',
            type:      'tool_result',
            tool:      'file.upload',
            status:    'success',
            title:     'Analysis complete',
            details:   msg.attachments[0].name,
            agent:     'DocumentAgent',
            timestamp: new Date().toISOString()
        });
        PFTemplate.aiPanel.appendAssistant(reply);
    })
    .catch(function() {
        PFTemplate.AgentEventBus.emit({
            id:        runId + '-err',
            type:      'tool_result',
            tool:      'file.upload',
            status:    'error',
            title:     'Upload failed',
            agent:     'DocumentAgent',
            timestamp: new Date().toISOString()
        });
    });
});
```

**Activity tab renders:**
```
⟳  Uploading quarterly-report.pdf     [running → success]
✓  Analysis complete
```

---

## Where to put your wiring code

Place your `InputEventBus.on(...)` call in the `<ui:insert name="scripts">` slot of your page:

```xml
<ui:define name="scripts">
    <script>
        PFTemplate.DemoAgent.enabled = false;

        PFTemplate.InputEventBus.on('user_message', function(msg) {
            // your handler
        });
    </script>
</ui:define>
```

This runs after `layout.js` has loaded and `PFTemplate` is available.
The template fires no events until the user explicitly presses Send — safe to register at any point.