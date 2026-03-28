# @splcode/create-plugin-driver

Scaffolds a new Podcart plugin driver with optional UI. Run it inside an empty folder to generate a working plugin with driver backend, UI scaffolding, and build scripts.

## Usage

```bash
mkdir MyPlugin && cd MyPlugin
npx @splcode/create-plugin-driver
```

The tool will prompt you for:

| Prompt | Description |
|--------|-------------|
| **Driver class name** | PascalCase name for the driver class. Defaults to the folder name. |
| **Plugin UI type** | `None` (schema-driven), `Vanilla` (custom element), or `Mantine` (React + Mantine custom element). |
| **Custom element tag name** | Only for Vanilla/Mantine. Must contain a hyphen (web component requirement). |
| **UI tab name** | Which tab the plugin appears under in the Podcart UI (e.g. `lighting`, `audio`, `video`). |

After prompts, it installs dependencies and (for Mantine) builds the UI automatically.

## What gets generated

### All types

```
MyPlugin/
  index.js          # Driver — extends PodcartAbstractDriver
  package.json      # Dependencies and build scripts
  .gitignore
```

### None (schema-driven)

No UI folder. The driver declares its interface via `getUiLayout()` using built-in component types (`card`, `stack`, `text`, `commandButton`, `toggleSwitch`, `textMeter`, etc.). The host app renders these automatically. No build step required.

### Vanilla (custom element)

A single JS file with a hand-written custom element using shadow DOM. No build step required.

```
MyPlugin/
  ui/
    ui.js           # Custom element — HTML/CSS/JS in one file
```

### Mantine (React + Mantine custom element)

A full React + Mantine app bundled into a custom element with shadow DOM isolation.

```
MyPlugin/
  ui/
    src/
      entry.tsx     # Custom element wrapper — mounts React into shadow DOM
      App.tsx       # Your plugin UI — React components
      bridge.tsx    # usePluginMeter / usePluginEvent hooks
      theme.ts      # Mantine theme configuration
    vite.config.ts
    tsconfig.json
    package.json
    dist/           # Built output (JS + CSS)
```

## Build commands

None and Vanilla plugins have no build step — the host loads `index.js` and `ui/ui.js` directly.

| Type | Command | Description |
|------|---------|-------------|
| Mantine | `npm run build` | Builds the UI with Vite |
| Mantine | `npm run watch` | Rebuilds the UI on file changes |

## Registering a plugin

Add the plugin to `control-api/config.yaml`:

```yaml
devices:
  myDevice:
    driver: 'MyPlugin'
    config:
      ip: '192.168.1.100'
```

The `driver` value must match the folder name in `podcart-plugins/`. Config values are available in the driver as `this.config`.

## Demo features

The generated demo plugin includes interactive examples of each communication pattern:

- **Counter** — demonstrates server-side commands via `sendEvent` (Vanilla/Mantine) or `commandButton` (schema). The UI sends an event, the driver increments server-side, and echoes the new value back.
- **Checkbox** — demonstrates direct meter state via `setMeter`. The UI sends `true`/`false`, the driver stores it and echoes back.
- **Config display** — demonstrates reading `this.config` from the YAML and exposing it as a meter.
