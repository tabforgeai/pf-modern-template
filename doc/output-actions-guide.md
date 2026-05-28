# Output Action Toolbar & TTS Player — Developer Guide

This guide covers two opt-in extensions to the AI chat panel that let your application
interact with completed AI responses:

- **Output Action Toolbar** — add custom buttons (translate, save, export) to every response
- **TTS Player** — let users hear responses read aloud, powered by a TTS backend you provide

Neither feature does anything until your application registers a handler. There is nothing
to configure in the template itself.

---

## Output Action Toolbar

### What the template gives you

When an AI response finishes streaming, a toolbar appears below it on hover.
Two buttons are always present regardless of what your application does:

| Button | What it does |
|--------|-------------|
| **Retry** | Removes the response and re-streams it from the last user message |
| **Copy** | Copies plain-text content to the clipboard; shows "Copied!" for 2 seconds |

Your application can add any number of buttons to the right of these two.

### Adding a custom button

Call `PFTemplate.registerOutputAction(def)` once, after `layout.js` has loaded:

```javascript
PFTemplate.registerOutputAction({
    type:    'translate',        // unique ID — not shown to user
    icon:    'pi-language',      // PrimeIcons class without 'pi ' prefix
    title:   'Translate',        // button label and tooltip
    handler: function(text, msgEl) {
        // text   — plain-text content of the AI response (no HTML, no markdown syntax)
        // msgEl  — the .ai-message-assistant DOM wrapper for this response
        myApp.translate(text);
    }
});
```

The button appears on every **new** response after registration. Responses already rendered
on screen are not affected — register before any messages are sent.

PrimeIcons class names (without the `pi ` prefix): `pi-language`, `pi-envelope`,
`pi-download`, `pi-bookmark`, `pi-share-alt`, etc.
Full list at: primeng.org/icons

### Step-by-step example — "Save to Notes" button

**Goal:** add a Save button that stores the response in `localStorage`.

**Step 1 — Register the action**

In `<ui:define name="scripts">` of your page:

```javascript
PFTemplate.registerOutputAction({
    type:  'save-note',
    icon:  'pi-bookmark',
    title: 'Save',
    handler: function(text) {
        var notes = JSON.parse(localStorage.getItem('ai-notes') || '[]');
        notes.push({ text: text, savedAt: new Date().toISOString() });
        localStorage.setItem('ai-notes', JSON.stringify(notes));

        // Optional: reflect save in the Activity tab
        PFTemplate.AgentEventBus.emit({
            type:      'tool_result',
            status:    'success',
            title:     'Response saved to notes',
            timestamp: new Date().toISOString()
        });
    }
});
```

**Step 2 — Test**

Send a message → hover over the response → toolbar shows `[↩ Retry] [📋 Copy] [🔖 Save]`.
Click Save → check `localStorage.getItem('ai-notes')` in the browser console.

### Registering multiple buttons

Each call to `registerOutputAction` appends one button:

```javascript
PFTemplate.registerOutputAction({ type: 'translate', icon: 'pi-language', title: 'Translate', handler: translateFn });
PFTemplate.registerOutputAction({ type: 'email',     icon: 'pi-envelope',  title: 'Email',     handler: emailFn });
PFTemplate.registerOutputAction({ type: 'export',    icon: 'pi-download',  title: 'Export',    handler: exportFn });
```

Buttons appear in registration order, all to the right of Copy.

---

## TTS Player

### What the template gives you

Register a TTS provider and the template adds a **Speak** button to every new response.
When the user clicks it, a compact audio player bar appears below the response:

```
▶  ─────────────────────  0:08 / 0:45  ×
```

| Control | What it does |
|---------|-------------|
| `▶` / `⏸` | Play / pause |
| Progress bar | Click anywhere to seek |
| `0:08 / 0:45` | Current time / total duration |
| `×` | Stop and close the player |

One message plays at a time — starting a second one automatically stops the first.
A loading spinner appears while your provider function is running, then transitions to the player.

### What you need to provide

A single `async` function that receives the response text and returns either:
- a **`Blob`** — audio bytes in any browser-supported format (MP3, WAV, OGG)
- a **URL string** — pointing to an audio file (served by your backend or a signed storage URL)

The template handles everything else.

---

### Step 1 — Register a TTS handler

In `<ui:define name="scripts">`:

```javascript
PFTemplate.TtsPlayer.register(async function(text) {
    var resp = await fetch('/myapp/api/tts', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ text: text })
    });
    if (!resp.ok) throw new Error('TTS request failed');
    return await resp.blob();   // Blob → browser plays it directly
});
```

If the function throws, the loading spinner disappears silently and playback is aborted.

---

### Step 2 — Build a Jakarta EE TTS endpoint

Your backend receives the text, calls a TTS provider, and returns raw audio bytes.
The example below uses Amazon Polly but any provider that returns audio bytes works
(Google Cloud TTS, ElevenLabs, OpenAI TTS, etc.).

```java
import jakarta.ws.rs.*;
import jakarta.ws.rs.core.*;
import jakarta.enterprise.context.RequestScoped;

/**
 * Converts AI response text to speech using a TTS provider.
 * Returns raw MP3 bytes; the browser plays them directly via the HTML5 Audio API.
 *
 * @param body — JSON: { "text": "..." }
 * @returns audio/mpeg stream
 */
@Path("/api/tts")
@RequestScoped
public class TtsResource {

    @Inject
    private TtsService ttsService;

    @POST
    @Consumes(MediaType.APPLICATION_JSON)
    @Produces("audio/mpeg")
    public Response synthesize(TtsRequest body) {
        byte[] audio = ttsService.synthesize(body.getText());
        return Response.ok(audio)
                       .header("Cache-Control", "no-store")
                       .build();
    }
}
```

```java
public class TtsRequest {
    private String text;
    public String getText()         { return text; }
    public void setText(String t)   { this.text = t; }
}
```

**Example `TtsService` using Amazon Polly:**

```java
import software.amazon.awssdk.services.polly.PollyClient;
import software.amazon.awssdk.services.polly.model.*;
import jakarta.enterprise.context.ApplicationScoped;

@ApplicationScoped
public class TtsService {

    private final PollyClient polly = PollyClient.create();

    public byte[] synthesize(String text) {
        var req = SynthesizeSpeechRequest.builder()
            .text(text)
            .outputFormat(OutputFormat.MP3)
            .voiceId(VoiceId.JOANNA)
            .build();
        try (var resp = polly.synthesizeSpeech(req)) {
            return resp.audioStream().readAllBytes();
        } catch (Exception e) {
            throw new RuntimeException("TTS synthesis failed", e);
        }
    }
}
```

---

### Step 3 — Full page wiring

```xml
<ui:define name="scripts">
    <script>
        PFTemplate.DemoAgent.enabled = false;

        // TTS provider
        PFTemplate.TtsPlayer.register(async function(text) {
            var trimmed = text.length > 2000 ? text.substring(0, 2000) + '…' : text;
            var resp = await fetch('/myapp/api/tts', {
                method:  'POST',
                headers: { 'Content-Type': 'application/json' },
                body:    JSON.stringify({ text: trimmed })
            });
            if (!resp.ok) throw new Error('TTS failed');
            return await resp.blob();
        });

        // Chat handler
        PFTemplate.InputEventBus.on('user_message', function(msg) {
            if (!msg.text) return;
            fetch('/myapp/api/chat', {
                method:  'POST',
                headers: { 'Content-Type': 'application/json' },
                body:    JSON.stringify({ text: msg.text })
            })
            .then(function(r) { return r.text(); })
            .then(function(reply) {
                PFTemplate.aiPanel._stream(reply);
                PFTemplate.setAiStatus('idle');
            });
        });
    </script>
</ui:define>
```

### What the user sees

```
You:        Explain the water cycle in simple terms.
Assistant:  Water evaporates from oceans and lakes, rises as vapour, cools into clouds,
            and falls as rain or snow — then the cycle repeats.

            [↩ Retry]  [📋 Copy]  [🔊 Speak]

            ▶  ─────────────────────  0:08 / 0:31  ×
```

---

### Returning a URL instead of a Blob

If your TTS backend returns a redirect or signed URL rather than bytes, return the URL string:

```javascript
PFTemplate.TtsPlayer.register(async function(text) {
    var resp = await fetch('/myapp/api/tts/url', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ text: text })
    });
    var data = await resp.json();
    return data.url;   // e.g. "https://storage.example.com/tts/abc123.mp3"
});
```

---

### Notes on text length

TTS APIs have input limits (Amazon Polly: 3 000 chars; OpenAI TTS: 4 096 chars).
Trim in your handler to avoid errors:

```javascript
PFTemplate.TtsPlayer.register(async function(text) {
    var trimmed = text.length > 2000 ? text.substring(0, 2000) + '…' : text;
    // ... fetch call
});
```

---

## Combining both features

Output actions and TTS can be used together on the same page.
Register them both before any messages are sent:

```xml
<ui:define name="scripts">
    <script>
        // Custom action buttons
        PFTemplate.registerOutputAction({
            type:    'save',
            icon:    'pi-bookmark',
            title:   'Save',
            handler: function(text) { myApp.saveNote(text); }
        });

        PFTemplate.registerOutputAction({
            type:    'translate',
            icon:    'pi-language',
            title:   'Translate',
            handler: function(text) { myApp.translate(text); }
        });

        // TTS
        PFTemplate.TtsPlayer.register(async function(text) {
            var resp = await fetch('/myapp/api/tts', {
                method:  'POST',
                headers: { 'Content-Type': 'application/json' },
                body:    JSON.stringify({ text: text.substring(0, 2000) })
            });
            return await resp.blob();
        });
    </script>
</ui:define>
```

The resulting toolbar for each response:

```
[↩ Retry]  [📋 Copy]  [🔊 Speak]  [🔖 Save]  [🌐 Translate]
```

---

## Where to put your code

All registrations go in `<ui:define name="scripts">` in your `.xhtml` page:

```xml
<ui:define name="scripts">
    <script>
        PFTemplate.registerOutputAction({ ... });
        PFTemplate.TtsPlayer.register(async function(text) { ... });
    </script>
</ui:define>
```

This block runs after `layout.js` has loaded and `PFTemplate` is available.
The template fires no UI actions until the user interacts — safe to register at any point during page load.