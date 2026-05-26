# Plugin Guide

Plugins extend the Activity Panel with custom event types — their own icons, colors, and labels — without modifying the template source.

## Plugin Structure

```javascript
{
    id:       'my-plugin',       // unique identifier (required)
    label:    'My Plugin',       // human-readable name (optional)
    renderers: {
        'event.type': (event) => ({
            icon:  'pi-icon-name',   // PrimeIcons class without 'pi ' prefix
            color: '#hexcolor',      // icon color
            label: 'Display label'  // timeline row label (fallback to event.title)
        })
    }
}
```

Register with:

```javascript
PFTemplate.registerPlugin(myPlugin);
```

Or directly:

```javascript
PFTemplate.RendererRegistry.register('event.type', (event) => ({
    icon:  'pi-cog',
    color: 'var(--primary-color)',
    label: event.title || 'My Event'
}));
```

---

## Example Plugins

### CRM Plugin

```javascript
PFTemplate.registerPlugin({
    id:    'crm-plugin',
    label: 'CRM Plugin',
    renderers: {
        'crm.lookup': (e) => ({
            icon:  'pi-users',
            color: '#6366f1',
            label: e.title || 'CRM Lookup'
        }),
        'crm.update': (e) => ({
            icon:  'pi-pencil',
            color: '#6366f1',
            label: e.title || 'CRM Update'
        }),
        'crm.create': (e) => ({
            icon:  'pi-user-plus',
            color: '#6366f1',
            label: e.title || 'CRM Create'
        }),
    }
});
```

Now your backend can emit:

```json
{
  "type":    "crm.lookup",
  "status":  "running",
  "title":   "Finding customer",
  "details": "Email: john@example.com",
  "agent":   "SalesAgent"
}
```

Timeline renders: purple users icon, "Finding customer".

---

### Browser Agent Plugin

```javascript
PFTemplate.registerPlugin({
    id:    'browser-agent',
    label: 'Browser Agent',
    renderers: {
        'browser.navigate': (e) => ({
            icon:  'pi-globe',
            color: '#0ea5e9',
            label: e.title || ('Navigate: ' + (e.details || ''))
        }),
        'browser.click': (e) => ({
            icon:  'pi-arrow-right',
            color: '#0ea5e9',
            label: e.title || 'Click element'
        }),
        'browser.extract': (e) => ({
            icon:  'pi-copy',
            color: '#0ea5e9',
            label: e.title || 'Extract content'
        }),
        'browser.screenshot': (e) => ({
            icon:  'pi-camera',
            color: '#0ea5e9',
            label: e.title || 'Screenshot'
        }),
    }
});
```

---

### ETL / Data Pipeline Plugin

```javascript
PFTemplate.registerPlugin({
    id:    'etl-pipeline',
    label: 'ETL Pipeline',
    renderers: {
        'etl.extract':   (e) => ({ icon: 'pi-download',  color: '#f59e0b', label: e.title || 'Extract' }),
        'etl.transform': (e) => ({ icon: 'pi-sync',      color: '#f59e0b', label: e.title || 'Transform' }),
        'etl.load':      (e) => ({ icon: 'pi-upload',    color: '#f59e0b', label: e.title || 'Load' }),
        'etl.validate':  (e) => ({ icon: 'pi-check',     color: '#22c55e', label: e.title || 'Validate' }),
        'etl.error':     (e) => ({ icon: 'pi-times',     color: '#ef4444', label: e.title || 'Pipeline error' }),
    }
});
```

---

### Code Agent Plugin

```javascript
PFTemplate.registerPlugin({
    id:    'code-agent',
    label: 'Code Agent',
    renderers: {
        'code.read':     (e) => ({ icon: 'pi-file',       color: '#8b5cf6', label: e.title || 'Read file' }),
        'code.write':    (e) => ({ icon: 'pi-file-edit',  color: '#8b5cf6', label: e.title || 'Write file' }),
        'code.execute':  (e) => ({ icon: 'pi-play',       color: '#8b5cf6', label: e.title || 'Execute' }),
        'code.test':     (e) => ({ icon: 'pi-check-square', color: '#22c55e', label: e.title || 'Run tests' }),
        'code.lint':     (e) => ({ icon: 'pi-search',     color: '#8b5cf6', label: e.title || 'Lint' }),
    }
});
```

---

## Renderer Function Reference

```javascript
(event) => ({
    icon:  string,   // PrimeIcons class, e.g. 'pi-globe', 'pi-database'
    color: string,   // CSS color value — hex, rgb(), or CSS variable
    label: string    // Text shown in timeline row
})
```

The `event` parameter is the full event object as received from the bus:

```javascript
'my.type': (event) => ({
    icon:  event.status === 'error' ? 'pi-times-circle' : 'pi-cog',
    color: event.status === 'error' ? '#ef4444' : 'var(--primary-color)',
    label: event.title || event.details || event.type
})
```

---

## Available PrimeIcons (selection)

| Category | Icons |
|----------|-------|
| Status | `pi-check`, `pi-check-circle`, `pi-times`, `pi-times-circle`, `pi-exclamation-triangle` |
| Data | `pi-database`, `pi-table`, `pi-filter`, `pi-sort-alt` |
| Files | `pi-file`, `pi-file-edit`, `pi-copy`, `pi-download`, `pi-upload` |
| Network | `pi-globe`, `pi-cloud`, `pi-wifi`, `pi-link` |
| People | `pi-user`, `pi-users`, `pi-user-plus` |
| Code | `pi-code`, `pi-terminal`, `pi-play`, `pi-stop` |
| UI | `pi-cog`, `pi-pencil`, `pi-trash`, `pi-search`, `pi-refresh` |
| AI | `pi-sparkles`, `pi-th-large`, `pi-sitemap` |

Full list: [PrimeIcons](https://primeng.org/icons)

---

## Listing registered plugins

```javascript
PFTemplate.PluginRegistry.list();
// → [{ id: 'crm-plugin', label: 'CRM Plugin' }, { id: 'browser-agent', label: 'Browser Agent' }]
```

---

## Loading plugins from a separate file

For larger applications, put each plugin in its own file and load it after `layout.js`:

```xml
<!-- In your template.xhtml or page -->
<h:outputScript name="js/plugins/crm-plugin.js" library="myapp" pt:defer="true" />
<h:outputScript name="js/plugins/browser-agent.js" library="myapp" pt:defer="true" />
```

```javascript
// src/main/webapp/resources/myapp/js/plugins/crm-plugin.js
PFTemplate.registerPlugin({
    id: 'crm-plugin',
    // ...
});
```
