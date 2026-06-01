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

The AI panel fires a `user_message` event on `InputEventBus` each time the user sends a message. Wire it up in your page scripts:

```javascript
PFTemplate.AgentEventBus.on('*', function(event) {
    console.log('Agent event:', event.type, event.status);
});

document.addEventListener('DOMContentLoaded', function() {
    // Listen for outbound user messages
    // Forward to your backend via fetch / WebSocket / SSE
});
```

Full API reference: [api-reference.md](api-reference.md)

---

## Folder reference

| ZIP path | Copy to | Notes |
|---|---|---|
| `WEB-INF/pf-modern-template/` | `src/main/webapp/WEB-INF/pf-modern-template/` | New subfolder — safe to add alongside existing WEB-INF files |
| `resources/pf-template/` | `src/main/webapp/resources/pf-template/` | New JSF resource library — no conflicts |
| `login.xhtml` | `src/main/webapp/login.xhtml` | Optional — skip if you already have a login page |
| `java/` | `src/main/java/` | Copy bean source files, adjust package if needed |
