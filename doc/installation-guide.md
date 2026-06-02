# Installation Guide

This guide explains how to add **PF Modern Template** to an existing Jakarta EE / PrimeFaces web application.

---

## Prerequisites

| Requirement | Version |
|---|---|
| Jakarta EE | 11 (Faces 4.1, CDI 4.1) |
| PrimeFaces | 15.x (jakarta classifier) |
| Java | 21+ |
| Application server | GlassFish 8 · WildFly 34+ · Payara 6.2+ · Open Liberty 24+ |

### Keep your PrimeFaces theme

**Do not set `primefaces.THEME=none`.** This template provides the application *layout* (topbar,
sidebar, AI panel, command palette), design tokens (CSS custom properties), and custom components —
but it does **not** ship a full theme for the standard PrimeFaces components (`p:dataTable`,
`p:inputText`, `p:commandButton`, etc.).

Your PrimeFaces components still need a PrimeFaces theme to look styled. Keep whatever theme your
project already uses (e.g. a PrimeFaces theme JAR such as `saga`, `arya`, `vela`, or a PrimeFlex /
PrimeFaces 15 theme):

```xml
<!-- web.xml — keep your existing theme, e.g.: -->
<context-param>
    <param-name>primefaces.THEME</param-name>
    <param-value>saga</param-value>
</context-param>
```

The template's layout styling lives in its own CSS layer (`@layer pf-template, app`) and design
tokens, so it coexists with a PrimeFaces theme without conflict. To match the template's accent
color to your theme, override the `--primary-color` token (see Step 7).

---

## Step 1 — Download

Download `pf-modern-template-<version>-layout.zip` from the [GitHub Releases](https://github.com/tabforgeai/pf-modern-template/releases) page.

---

## Step 2 — Extract web resources

The ZIP contains three distinct parts. Copy each to the correct location in your project — **do not extract the entire ZIP into one folder**, as your project already has its own `WEB-INF/` with `web.xml`, `beans.xml`, etc.

### 2a — Facelets templates

Copy the `WEB-INF/pf-modern-template/` folder from the ZIP into your project's `src/main/webapp/WEB-INF/`:

```
src/main/webapp/WEB-INF/
├── beans.xml             ← your existing file, untouched
├── web.xml               ← your existing file, untouched
├── faces-config.xml      ← your existing file, untouched
├── ...                   ← your other existing files, untouched
└── pf-modern-template/   ← NEW — copy this folder from the ZIP
    ├── template.xhtml
    ├── topbar.xhtml
    ├── footer.xhtml
    ├── config.xhtml
    ├── menu.xhtml
    └── breadcrumb.xhtml
```

### 2b — Static resources (CSS · JS · images)

Copy the `resources/pf-template/` folder from the ZIP into your project's `src/main/webapp/resources/`:

```
src/main/webapp/resources/
└── pf-template/          ← NEW — copy this folder from the ZIP
    ├── css/
    ├── js/
    └── images/
```

This is a new JSF resource library (`library="pf-template"`) and will not conflict with any existing library in your project.

### 2c — Login page (optional)

The ZIP includes a ready-to-use `login.xhtml`. Copy it to `src/main/webapp/` **only if your project does not already have one**, or use it as a reference to update your existing login page.

---

## Step 3 — Add the CDI beans

Copy the `java/` folder from the extracted ZIP into your **`src/main/java/`** directory.

```
src/main/java/
└── ai/tabforge/pagetemplate/bean/
    ├── GuestPreferencesBean.java   ← theme, menu layout, RTL preferences
    ├── NotificationsBean.java      ← topbar notification items
    ├── NotificationItem.java
    ├── AiPanelBean.java            ← AI panel state
    ├── BreadcrumbBean.java
    └── LoginBean.java              ← demo login (replace with your auth logic)
```

You may rename the package to match your project's conventions. If you do, update the EL expressions in the XHTML templates accordingly (search for `#{guestPreferences`, `#{notifications`, `#{aiPanel`).

CDI auto-discovery must be enabled in your `beans.xml`:

```xml
<beans xmlns="https://jakarta.ee/xml/ns/jakartaee"
       version="4.0"
       bean-discovery-mode="all">
</beans>
```

---

## Step 4 — Use the template in your pages

Reference the template with a path relative to your `WEB-INF/` root:

```xhtml
<ui:composition xmlns="http://www.w3.org/1999/xhtml"
                xmlns:ui="jakarta.faces.facelets"
                template="/WEB-INF/pf-modern-template/template.xhtml">

    <ui:define name="title">My Page</ui:define>

    <ui:define name="content">
        <p:card header="Hello">
            <p>Your content goes here.</p>
        </p:card>
    </ui:define>

</ui:composition>
```

### Available template slots

| Slot | Description |
|---|---|
| `title` | Browser tab title |
| `head-extra` | Extra `<link>` or `<meta>` tags in `<head>` |
| `content` | Main page content |
| `statusbar-context` | Left section of the bottom status bar (default: `Home`) |
| `scripts` | Page-specific `<script>` tags before `</body>` |

---

## Step 5 — Customize the sidebar menu

Open `WEB-INF/pf-modern-template/menu.xhtml` and replace the placeholder items with your
application's navigation. The sidebar uses this structure — keep the `menu-group` / `menu-list` /
`menu-link` / `menu-icon` / `menu-label` classes so items inherit the template's sidebar styling:

```xhtml
<div class="menu-group">
    <span class="menu-group-label">Main</span>
    <ul class="menu-list" role="list">
        <li>
            <a href="#{request.contextPath}/yourpage.xhtml" class="menu-link">
                <i class="pi pi-home menu-icon" />
                <span class="menu-label">Dashboard</span>
            </a>
        </li>
    </ul>
</div>
```

### Choosing the right link type

The template ships with plain `<a>` links so it works standalone. Depending on how your app
navigates, swap the `<a>` for one of these — all keep the same `menu-link` / `menu-icon` /
`menu-label` styling:

| Link type | Use for | Example |
|---|---|---|
| `<a href>` | External URLs, client-side actions (e.g. `PFTemplate.toggleAiPanel()`) | `<a href="..." class="menu-link">` |
| `h:link` | Plain JSF view navigation between `.xhtml` pages | `<h:link outcome="/page" styleClass="menu-link">` |
| `p:commandLink` | Action-based navigation (dynamic tabs / shell navigation handlers) | see below |

**Action-based navigation** (e.g. a dynamic-tabs "shell" pattern). Wrap the whole menu in a single
`h:form`, and use `p:commandLink` (add `xmlns:p="http://primefaces.org/ui"` to the composition):

```xhtml
<h:form id="menuForm">
    <div class="menu-group">
        <span class="menu-group-label">Main</span>
        <ul class="menu-list" role="list">
            <li>
                <p:commandLink action="uishell:Home"
                               process="@this"
                               immediate="true"
                               styleClass="menu-link">
                    <i class="pi pi-home menu-icon" />
                    <span class="menu-label">Home</span>
                </p:commandLink>
            </li>
        </ul>
    </div>
</h:form>
```

One `h:form` can wrap the entire menu — all `p:commandLink`s share it. If your navigation replaces
the whole view rather than updating a panel via AJAX, add `ajax="false"` to the `p:commandLink`.

> **Note:** `p:menuitem` cannot be used directly inside this HTML structure — it must live inside a
> PrimeFaces menu component (`p:menu`, `p:menubar`). Using `p:menu` would also discard the template's
> sidebar styling in favor of the PrimeFaces theme. Use `p:commandLink` / `h:link` to keep the
> template look while getting JSF navigation.

---

## Step 6 — Customize the logo and brand name

In `topbar.xhtml` and `login.xhtml`, replace the logo image and "PF Modern" text:

```xhtml
<h:graphicImage library="pf-template" name="images/logo.png"
                styleClass="topbar-logo-img" alt="Logo" />
<span class="topbar-logo-text">Your App Name</span>
```

Place your logo at `src/main/webapp/resources/pf-template/images/logo.png` (32×32 px recommended).

---

## Step 7 — Customize the theme colors

All design tokens are CSS Custom Properties in `resources/pf-template/css/layout-variables.css`. Override just the variables you need in your own stylesheet — no need to edit the template files:

```css
/* your-app.css */
:root {
    --primary-color:      #0ea5e9;   /* brand blue  */
    --primary-color-text: #ffffff;
}
```

---

## Optional — Login page

`login.xhtml` is a standalone page that does not use `template.xhtml`. It is ready to use as-is for demo purposes (`LoginBean` accepts any non-empty credentials).

For production, replace the `login()` method in `LoginBean.java` with your actual authentication logic (JAAS, security framework, etc.).

To use a different background image, place your image in `resources/pf-template/images/` and update the inline style in `login.xhtml`:

```xhtml
<style>
    .login-image-panel {
        background-image: url('#{resource["pf-template:images/your-image.jpg"]}');
    }
</style>
```

---

## Connecting the AI Assistant

Out of the box, the chat panel runs in **demo mode**: typing a message produces a fake
typewriter reply and simulated "Activity" events, so the UI is fully interactive before you
write any backend code. This section shows how to replace that demo with your real backend.

### How it works (the mental model)

The template is a **pure frontend**. It never calls your backend itself — instead it exposes
two event buses on the global `PFTemplate` object:

| Bus | Direction | You use it to… |
|---|---|---|
| `PFTemplate.InputEventBus` | **outbound** (user → you) | **receive** every message the user sends in the chat |
| `PFTemplate.AgentEventBus` | **inbound** (you → template) | optionally feed live "Activity" events back into the panel |

To show a reply in the chat you call one method: **`PFTemplate.aiPanel.streamAssistant(text)`**.

### Step 1 — Turn off the demo

```javascript
PFTemplate.DemoAgent.enabled = false;
```

This single line stops both the fake chat reply and the simulated Activity events. The chat
now waits for *your* code to provide a reply.

### Step 2 — Receive the chat messages

This is the part most apps need: **read what the user typed.** Subscribe to `user_message`
and you get every message, including any attachments:

```javascript
PFTemplate.InputEventBus.on('user_message', function (msg) {
    console.log(msg.text);          // the text the user typed
    console.log(msg.attachments);   // [{ id, type, mimeType, name, size }]  — JSON-safe metadata
    console.log(msg.files);         // [{ id, file }]  — native File objects, for upload
    console.log(msg.systemPrompt);  // the configured system prompt, if any
});
```

> The `text` you read here is exactly the string the user typed. What you do with it is up to
> you — send it to a REST endpoint, a WebSocket, an LLM SDK, or just log it.

### Step 3 — Show the reply

Call `streamAssistant(text)` with your backend's response. It renders with the same typewriter
animation, markdown formatting, code-copy buttons, and action toolbar as the demo:

```javascript
PFTemplate.aiPanel.streamAssistant('Hello from my backend!');   // markdown is supported
```

### Putting it together — the minimal pattern

You **don't** need to write the JavaScript above yourself — the wiring is already included in
`template.xhtml`, just before `</h:body>`. It runs on every page that uses the template and stays
in **demo mode** until you point it at your backend. Open `template.xhtml` and set one line:

```javascript
// in template.xhtml — change this from '' to your endpoint:
var AI_CHAT_ENDPOINT = '#{request.contextPath}/api/ai/chat';
```

> **Adjust the endpoint to match your application.** `#{request.contextPath}/api/ai/chat` is only
> an example. If your REST resource lives elsewhere (different `@ApplicationPath`, different
> `@Path`, an API gateway, an absolute URL, …), set `AI_CHAT_ENDPOINT` to that. Leaving it empty
> keeps the demo running.

That single block does everything: it disables the demo, subscribes to `user_message`, POSTs the
text to your endpoint, and renders the reply with `streamAssistant()`.

A matching Jakarta REST (JAX-RS) endpoint on the backend:

```java
@Path("/ai")
public class AiChatResource {

    @POST
    @Path("/chat")
    @Consumes(MediaType.APPLICATION_JSON)
    @Produces(MediaType.TEXT_PLAIN)
    public String chat(ChatRequest request) {
        String userText = request.getText();   // ← the message from the chat
        // Call your LLM (Anthropic Java SDK, etc.) and return its reply:
        return myAiService.ask(userText);
    }

    public static class ChatRequest {
        private String text;
        public String getText()           { return text; }
        public void   setText(String t)   { this.text = t; }
    }
}
```

That is everything you need to "have access to the messages sent through the chat" and reply
to them.

### Including file attachments

The chat lets users attach files (paperclip / image buttons, paste, or drag-and-drop). Each
`user_message` event therefore carries two parallel views of the attachments:

| Field | Contents | Use for |
|---|---|---|
| `msg.attachments` | `[{ id, type, mimeType, name, size }]` — **JSON-safe metadata only** | logging, previews, sending over SSE/WebSocket |
| `msg.files` | `[{ id, file }]` — the native browser **`File`** objects | actually uploading the bytes |

To upload the bytes you must send **`multipart/form-data`** instead of JSON. Replace the `fetch`
in the `template.xhtml` block with a `FormData` build:

```javascript
PFTemplate.InputEventBus.on('user_message', function (msg) {
    var form = new FormData();
    form.append('text', msg.text);
    msg.files.forEach(function (f) {
        form.append('files', f.file, f.file.name);   // f.file is a real File object
    });

    // NOTE: do not set a Content-Type header — the browser adds the multipart boundary.
    fetch(AI_CHAT_ENDPOINT, { method: 'POST', body: form })
        .then(function (r) { return r.text(); })
        .then(function (reply) { PFTemplate.aiPanel.streamAssistant(reply); });
});
```

On the backend, read the parts with Jakarta REST's standard `EntityPart` (Jakarta REST 3.1+,
included in Jakarta EE 10/11 — no vendor-specific API needed):

```java
@POST
@Path("/chat")
@Consumes(MediaType.MULTIPART_FORM_DATA)
@Produces(MediaType.TEXT_PLAIN)
public String chat(List<EntityPart> parts) throws IOException {
    String text = "";

    for (EntityPart part : parts) {
        if ("text".equals(part.getName())) {
            text = part.getContent(String.class);                 // the typed message
        } else if ("files".equals(part.getName())) {
            String   filename = part.getFileName().orElse("upload");
            String   mimeType = part.getMediaType().toString();
            try (InputStream in = part.getContent()) {
                byte[] bytes = in.readAllBytes();                 // the uploaded file
                // persist it, or forward it to your AI service:
                myAiService.addAttachment(filename, mimeType, bytes);
            }
        }
    }

    return myAiService.ask(text);
}
```

Each `<input type="file">` part shares the same form field name (`files`), so a single
`List<EntityPart>` receives the text plus every uploaded file in one request.

### Optional — live streaming and the Activity tab

If you want token-by-token streaming and the live **Activity** timeline (the second tab in the
panel), connect a Server-Sent Events or WebSocket stream and let the backend push events:

```javascript
PFTemplate.DemoAgent.enabled = false;
PFTemplate.AgentTransport.connectSSE('#{request.contextPath}/api/ai/stream');
```

Over that one channel your backend can send **both** the chat reply and activity events. The
template automatically routes an `assistant_message` event into the chat bubble; all other event
types render as Activity rows:

```jsonc
// chat reply  → appears in the Chat tab
{ "type": "assistant_message", "text": "Here is your answer…" }

// progress    → appears in the Activity tab
{ "type": "tool_call",      "status": "running", "title": "Searching knowledge base", "agent": "Assistant" }
{ "type": "agent_finished", "status": "success", "title": "Response ready",           "agent": "Assistant" }
```

See [api-reference.md](api-reference.md) for the full event shape and the complete `PFTemplate`
API (renderers, plugins, output actions, TTS, etc.).

---

## Folder reference

| ZIP path | Copy to | Notes |
|---|---|---|
| `WEB-INF/pf-modern-template/` | `src/main/webapp/WEB-INF/pf-modern-template/` | New subfolder — safe to add alongside existing WEB-INF files |
| `resources/pf-template/` | `src/main/webapp/resources/pf-template/` | New JSF resource library — no conflicts |
| `login.xhtml` | `src/main/webapp/login.xhtml` | Optional — skip if you already have a login page |
| `java/` | `src/main/java/` | Copy bean source files, adjust package if needed |
