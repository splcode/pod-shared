# Plugin Architecture

This document describes how Podcart plugins work — how drivers communicate with the host, how plugin UIs are loaded and isolated, and the available communication patterns.

## Overview

A Podcart plugin is a folder in `podcart-plugins/` containing a driver (backend) and optionally a UI (frontend). The host app loads drivers at startup and serves plugin UIs to the browser.

```
podcart-plugins/
  MyPlugin/
    index.js        # Driver — runs on the server
    ui/             # UI — served to the browser
```

## Driver (Backend)

Drivers extend `PodcartAbstractDriver` and implement a standard interface:

```js
import { PodcartAbstractDriver, eventBus } from '@splcode/pod-abstract-driver';

export default class MyPlugin extends PodcartAbstractDriver {
  async _connect()    {}  // Called when the driver starts
  async _disconnect() {}  // Called when the driver stops
  async _get(meter)   {}  // Return current value of a meter
  async _set(meter, value) {}  // Handle a meter update from a client

  getUiTab()    {}  // Which tab to appear under ('lighting', 'audio', etc.)
  getUiLayout() {}  // UI descriptor — schema components or pluginSurface
}
```

### Meters

Meters are named state values that sync between server and all connected clients. They are the primary communication channel.

```js
// Register a meter with an initial value during _connect()
this._registerMeter('brightness', 100);

// Echo a new value to all connected clients
this._meterEcho('brightness', 75);

// Return current value when polled
async _get(meterName) {
  if (meterName === 'brightness') return this.brightness;
}

// Handle updates from clients
async _set(meterName, value) {
  if (meterName === 'brightness') {
    this.brightness = Number(value);
    // ... do something with the value (send to hardware, etc.)
  }
}
```

### Configuration

Each driver receives its config from `config.yaml`:

```yaml
devices:
  myDevice:
    driver: 'MyPlugin'
    config:
      ip: '192.168.1.100'
      port: 8000
```

Access in the driver via `this.config`:

```js
async _connect() {
  const { ip, port } = this.config;
  this.log.info(`Connecting to ${ip}:${port}`);
}
```

### Logging

Three log levels are available, each prefixed with the driver name in color:

```js
this.log.info('Connected');     // white
this.log.warn('Retrying...');   // yellow
this.log.error('Failed', err);  // red
```

### EventBus

The eventBus is a global Node.js EventEmitter shared across all drivers. It serves two purposes:

**Server-to-server** — drivers communicate with each other:

```js
// One driver emits
eventBus.emit('sessionEnded');

// Another driver listens
eventBus.on('sessionEnded', () => {
  this.log.info('Session ended, resetting...');
});
```

**Client-to-server** — plugin UIs send events that get routed through the eventBus:

```js
// Browser sends (via uiHost.sendEvent)
sendEvent({ channel: 'counter.increment', payload: { amount: 1 } });

// Server routes to eventBus as:
//   eventBus.emit('plugin:event', { deviceId, channel, payload, ... })
//   eventBus.emit('plugin:event:counter.increment', { deviceId, channel, payload, ... })

// Driver listens on the channel-specific event
eventBus.on('plugin:event:counter.increment', (event) => {
  if (event.deviceId !== this.name) return;  // filter to this device
  this.counter += event.payload?.amount || 1;
  this._meterEcho('counter', this.counter);
});
```

Always clean up listeners in `_disconnect()`:

```js
async _disconnect() {
  eventBus.off('plugin:event:counter.increment', this._handler);
}
```

## UI Options

### 1. Schema-driven (no custom UI)

The driver returns a JSON layout descriptor from `getUiLayout()`. The host renders it using built-in Mantine components. No UI code needed.

```js
getUiLayout() {
  return {
    type: 'card',
    styleProps: { withBorder: true, p: 'lg' },
    components: [
      { type: 'text', content: 'My Plugin', styleProps: { size: 'xl', fw: 700 } },
      { type: 'toggleSwitch', meter: 'enabled', label: 'Enable', styleProps: { size: 'lg' } },
      { type: 'textMeter', meter: 'status', styleProps: { c: 'dimmed' } },
    ],
  };
}
```

Available component types: `box`, `card`, `paper`, `stack`, `center`, `text`, `textMeter`, `toggleButton`, `commandButton`, `toggleIcon`, `toggleSwitch`, `led`, `statusLed`, `enabledTextInput`, `disabledTextInput`, `dropdownMenu`, `audioSliderLinearHorizontal`, `audioSliderDbHorizontal`, `audioSlider8BitHorizontal`, `audioMeter`, `ptzControl`.

See `types/uiLayout.d.ts` in the main Podcart repo for full type definitions.

### 2. Plugin Surface (custom UI)

The driver returns a `pluginSurface` descriptor that points to a custom element:

```js
getUiLayout() {
  return {
    type: 'pluginSurface',
    mode: 'element',
    pluginId: 'MyPlugin',
    tagName: 'my-plugin-ui',
    entry: '/plugin-ui/MyPlugin/ui/dist/my-plugin-ui.js',
  };
}
```

The host app:
1. Loads the entry JS via dynamic `import()`
2. Creates the custom element (`<my-plugin-ui>`)
3. Injects a `uiHost` bridge object
4. Dispatches `ui-host-ready` event

## Plugin UI Bridge

The `uiHost` object is the plugin's interface to the Podcart system. It is set on the custom element by the host before dispatching `ui-host-ready`.

### uiHost.subscribeMeter(name, callback)

Subscribe to a meter. The name is device-local — `subscribeMeter('brightness')` subscribes to `myDevice/brightness` automatically. Returns an unsubscribe function.

```js
const unsub = this.uiHost.subscribeMeter('brightness', ({ value, skipLock }) => {
  console.log('brightness is now', value);
});

// Later:
unsub();
```

### uiHost.setMeter(name, value)

Push a value to a meter. Triggers the driver's `_set()` method.

```js
this.uiHost.setMeter('brightness', 75);
```

### uiHost.sendEvent({ channel, payload })

Send a command to the server. The server routes it through the eventBus as `plugin:event:{channel}`. Use this for actions ("do something") rather than state ("set this value").

```js
this.uiHost.sendEvent({
  channel: 'counter.increment',
  payload: { amount: 5 },
});
```

## Shadow DOM and CSS Isolation

Plugin surface UIs render inside a shadow DOM boundary. This means:

- **Host CSS does not leak into the plugin.** The plugin must provide all its own styles.
- **Plugin CSS does not leak into the host.** No conflicts with other plugins or the host app.

### Mantine in Shadow DOM

Mantine components work inside shadow DOM with two required configurations:

1. **CSS variables** — set `cssVariablesSelector=":host"` on `MantineProvider` so CSS variables target the shadow host instead of `:root`:

```tsx
<MantineProvider theme={theme} defaultColorScheme="dark" cssVariablesSelector=":host">
```

2. **Color scheme attribute** — set `data-mantine-color-scheme="dark"` on the container inside the shadow root. Mantine's component styles use `:where([data-mantine-color-scheme='dark'])` ancestor selectors for theming:

```js
const container = document.createElement('div');
container.setAttribute('data-mantine-color-scheme', 'dark');
shadow.appendChild(container);
```

3. **CSS file** — Vite extracts component styles to a separate CSS file. Load it into the shadow root via a `<link>` tag:

```js
const link = document.createElement('link');
link.rel = 'stylesheet';
link.href = new URL('./style.css', import.meta.url).href;
shadow.appendChild(link);
```

### Vite Build Configuration

Do **not** use Vite's library mode — it doesn't process CSS module imports from Mantine's internals. Use a standard `rollupOptions.input` build instead:

```ts
build: {
    outDir: 'dist',
    cssCodeSplit: false,
    rollupOptions: {
        input: 'src/entry.tsx',
        output: {
            entryFileNames: 'my-plugin-ui.js',
            assetFileNames: '[name][extname]',
        },
    },
}
```

Also define `process.env.NODE_ENV` since the bundle runs in a browser context without bundler shims:

```ts
define: {
    'process.env.NODE_ENV': JSON.stringify('production'),
}
```

## How Plugin UIs Are Served

### Development

The main app's Vite dev server has middleware that serves files from the `podcart-plugins/` directory at `/plugin-ui/*`. A request to `/plugin-ui/MyPlugin/ui/dist/my-plugin-ui.js` reads the file from disk. No host-side configuration needed.

### Production

Plugin UI assets need to be served at the same `/plugin-ui/` path. This typically means an Nginx rule or copying built assets during packaging.

## Communication Patterns Summary

| Pattern | Direction | Mechanism | Use case |
|---------|-----------|-----------|----------|
| **Meter read** | server → client | `subscribeMeter` / `_registerMeter` + `_meterEcho` | Displaying state (temperatures, counters, status) |
| **Meter write** | client → server | `setMeter` / `_set` | Direct state changes (toggles, sliders, text inputs) |
| **Event** | client → server | `sendEvent` / `eventBus.on('plugin:event:...')` | Commands and actions (increment, reset, trigger) |
| **Inter-driver** | server → server | `eventBus.emit` / `eventBus.on` | Cross-plugin coordination (session ended, mode change) |
