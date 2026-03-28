#!/usr/bin/env node

import fs from "fs";
import path from "path";
import { execSync } from "child_process";
import prompts from "prompts";

const projectPath = process.cwd();
const folderName = path.basename(projectPath);

// Convert folder name to PascalCase for class name suggestion
const defaultClassName = folderName
  .replace(/[^a-zA-Z0-9]+(.)/g, (_, c) => c.toUpperCase())
  .replace(/^(.)/, (_, c) => c.toUpperCase());

const response = await prompts([
  {
    type: "text",
    name: "className",
    message: "Driver class name",
    initial: defaultClassName,
  },
  {
    type: "select",
    name: "uiType",
    message: "Plugin UI type",
    choices: [
      { title: "None — schema-driven UI only (getUiLayout)", value: "none" },
      { title: "Vanilla — custom element with hand-written HTML/CSS", value: "vanilla" },
      { title: "Mantine — React + Mantine in a custom element", value: "mantine" },
    ],
    initial: 0,
  },
  {
    type: (prev) => (prev !== "none" ? "text" : null),
    name: "tagName",
    message: "Custom element tag name (must contain a hyphen)",
    initial: folderName.toLowerCase().replace(/[^a-z0-9]+/g, "-") + "-ui",
    validate: (v) => v.includes("-") || "Custom element names must contain a hyphen",
  },
  {
    type: "text",
    name: "uiTab",
    message: "UI tab name (e.g. lighting, audio, video)",
    initial: "lighting",
  },
]);

if (!response.className) {
  console.log("Cancelled.");
  process.exit(1);
}

const { className, uiType, tagName, uiTab } = response;

// Derive names from tag name
const jsFileName = tagName ? tagName : folderName.toLowerCase();
const pluginId = folderName;

console.log("");

// --- package.json ---
const packageJsonPath = path.join(projectPath, "package.json");
const packageJson = fs.existsSync(packageJsonPath)
  ? JSON.parse(fs.readFileSync(packageJsonPath, "utf8"))
  : { name: folderName, version: "1.0.0", type: "module" };

if (!packageJson.scripts) packageJson.scripts = {};
if (!packageJson.dependencies) packageJson.dependencies = {};
if (!packageJson.devDependencies) packageJson.devDependencies = {};

packageJson.scripts.build = [
  "npx esbuild index.js",
  "--bundle",
  "--format=esm",
  "--platform=node",
  "--outfile=dist/output.js",
  "--banner:js=\"import { createRequire } from 'module';",
  'const require = createRequire(import.meta.url);"',
].join(" ");

if (uiType === "mantine") {
  packageJson.scripts["build:ui"] = "cd ui && npx --no-install vite build";
  packageJson.scripts["build:all"] = "npm run build && npm run build:ui";
}

packageJson.dependencies["@splcode/pod-abstract-driver"] = "^1.4.0";
packageJson.devDependencies.esbuild = "^0.25.11";

fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2) + "\n");
console.log("✓ package.json");

// --- .gitignore ---
const gitignorePath = path.join(projectPath, ".gitignore");
if (!fs.existsSync(gitignorePath)) {
  fs.writeFileSync(gitignorePath, "node_modules/\ndist/\nui/node_modules/\nui/dist/\n");
  console.log("✓ .gitignore");
}

// --- dist/ ---
const distPath = path.join(projectPath, "dist");
if (!fs.existsSync(distPath)) {
  fs.mkdirSync(distPath, { recursive: true });
}

// --- index.js (driver) ---
const driverPath = path.join(projectPath, "index.js");
if (!fs.existsSync(driverPath)) {
  fs.writeFileSync(driverPath, generateDriver(className, uiType, pluginId, tagName, jsFileName, uiTab));
  console.log("✓ index.js");
}

// --- UI scaffolding ---
if (uiType === "vanilla") {
  createVanillaUI(projectPath, className, tagName, pluginId);
} else if (uiType === "mantine") {
  createMantineUI(projectPath, className, tagName, jsFileName, pluginId);
}

// --- Install deps ---
console.log("\nInstalling driver dependencies...");
execSync("npm install", { cwd: projectPath, stdio: "inherit" });

if (uiType === "mantine") {
  console.log("\nInstalling UI dependencies...");
  execSync("npm install", { cwd: path.join(projectPath, "ui"), stdio: "inherit" });
}

console.log("\n✅ Plugin created!");
if (uiType === "mantine") {
  console.log(`\nTo build the UI: npm run build:ui`);
  console.log(`To build everything: npm run build:all`);
} else if (uiType === "vanilla") {
  console.log(`\nThe vanilla UI (ui/ui.js) requires no build step.`);
}

// =============================================================================
// Generators
// =============================================================================

function generateDriver(className, uiType, pluginId, tagName, jsFileName, uiTab) {
  const uiMethods =
    uiType === "none"
      ? `
  getUiTab() {
    return '${uiTab || "audio"}';
  }

  getUiLayout() {
    return {
      type: 'card',
      styleProps: { withBorder: true, p: 'lg' },
      components: [
        {
          type: 'stack',
          styleProps: { gap: 'md' },
          components: [
            {
              type: 'text',
              content: '${className}',
              styleProps: { size: 'xl', fw: 700 },
            },
            {
              type: 'box',
              styleProps: { display: 'flex', gap: '12px', alignItems: 'center' },
              components: [
                {
                  type: 'commandButton',
                  content: 'Count Up',
                  meter: 'counter',
                  value: 'increment',
                },
                {
                  type: 'textMeter',
                  meter: 'counter',
                  styleProps: { size: 'lg' },
                  fallbackContent: '0',
                },
              ],
            },
            {
              type: 'toggleSwitch',
              meter: 'checked',
              label: 'Toggle',
              styleProps: { size: 'lg' },
            },
            {
              type: 'textMeter',
              meter: 'checkedLabel',
              styleProps: { size: 'sm', c: 'dimmed' },
              fallbackContent: 'server says unchecked',
            },
            {
              type: 'textMeter',
              meter: 'configInfo',
              styleProps: { size: 'xs', c: 'dimmed', ff: 'monospace' },
              fallbackContent: 'loading config...',
            },
          ],
        },
      ],
    };
  }`
      : `
  getUiTab() {
    return '${uiTab}';
  }

  getUiLayout() {
    return {
      type: 'pluginSurface',
      mode: 'element',
      pluginId: '${pluginId}',
      tagName: '${tagName}',
      entry: '/plugin-ui/${pluginId}/${uiType === "vanilla" ? "ui/ui.js" : `ui/dist/${jsFileName}.js`}',
    };
  }`;

  return `import { PodcartAbstractDriver } from '@splcode/pod-abstract-driver';

export default class ${className} extends PodcartAbstractDriver {
  counter = 0;
  checked = false;

  async _connect() {
    this.log.info('Connected with config:', this.config);
    this._registerMeter('counter', this.counter);
    this._registerMeter('checked', this.checked);
    this._registerMeter('checkedLabel', 'server says unchecked');
    this._registerMeter('configInfo', 'Config IP: ' + (this.config && this.config.ip || 'not set'));
  }

  async _disconnect() {}

  async _get(meterName) {
    switch (meterName) {
      case 'counter': return this.counter;
      case 'checked': return this.checked;
      case 'checkedLabel': return this.checked ? 'server says checked' : 'server says unchecked';
      case 'configInfo': return 'Config IP: ' + (this.config.ip || 'not set');
    }
  }

  async _set(meterName, value) {
    this.log.info('SET', meterName, value);
    switch (meterName) {
      case 'counter':
        // Counter increments server-side — value from client is ignored
        this.counter += 1;
        this._meterEcho('counter', this.counter);
        break;
      case 'checked':
        this.checked = Boolean(value);
        this._meterEcho('checked', this.checked);
        this._meterEcho('checkedLabel', this.checked ? 'server says checked' : 'server says unchecked');
        break;
    }
  }
${uiMethods}
}
`;
}

// =============================================================================
// Vanilla UI
// =============================================================================

function createVanillaUI(projectPath, className, tagName, pluginId) {
  const uiDir = path.join(projectPath, "ui");
  fs.mkdirSync(uiDir, { recursive: true });

  // ui.js — single-file custom element with shadow DOM
  fs.writeFileSync(
    path.join(uiDir, "ui.js"),
    `class ${className}Ui extends HTMLElement {
  connectedCallback() {
    if (this.shadowRoot) return;

    this.attachShadow({ mode: 'open' });
    this._unsubs = [];
    this._meters = { counter: 0, checked: false, configInfo: '' };

    this.render();
    this.initializeHost();
    this.addEventListener('podcart-host-ready', this.initializeHost);
  }

  disconnectedCallback() {
    this.removeEventListener('podcart-host-ready', this.initializeHost);
    this._unsubs?.forEach((unsub) => unsub());
    this._unsubs = [];
  }

  initializeHost = () => {
    if (!this.podcartHost || this._initialized) return;
    this._initialized = true;

    ['counter', 'checked', 'configInfo'].forEach((meter) => {
      const unsub = this.podcartHost.subscribeMeter(meter, ({ value }) => {
        this._meters[meter] = value;
        this.syncUI();
      });
      this._unsubs.push(unsub);
    });

    this.syncUI();
  };

  syncUI() {
    if (!this.shadowRoot) return;
    const counterEl = this.shadowRoot.querySelector('#counter');
    if (counterEl) counterEl.textContent = this._meters.counter;
    const checkedEl = this.shadowRoot.querySelector('#checked-status');
    if (checkedEl) checkedEl.textContent = this._meters.checked ? 'server says checked' : 'server says unchecked';
    const checkbox = this.shadowRoot.querySelector('#checked');
    if (checkbox) checkbox.checked = Boolean(this._meters.checked);
    const configEl = this.shadowRoot.querySelector('#config-info');
    if (configEl) configEl.textContent = this._meters.configInfo || 'loading config...';
  }

  render() {
    if (!this.shadowRoot) return;

    this.shadowRoot.innerHTML = \`
      <style>
        :host {
          display: block;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          color: #e0e0e0;
        }
        .panel {
          border: 1px solid rgba(255, 255, 255, 0.15);
          border-radius: 12px;
          padding: 24px;
          background: rgba(255, 255, 255, 0.04);
        }
        h2 { margin: 0 0 8px; font-size: 20px; }
        .row { display: flex; align-items: center; gap: 12px; margin-top: 12px; }
        .status { color: rgba(255, 255, 255, 0.6); margin-top: 8px; }
        .config { color: rgba(255, 255, 255, 0.4); font-family: monospace; font-size: 12px; margin-top: 12px; }
        button {
          padding: 8px 16px;
          border: 1px solid rgba(255, 255, 255, 0.2);
          border-radius: 8px;
          background: rgba(255, 255, 255, 0.08);
          color: #e0e0e0;
          cursor: pointer;
          font-size: 14px;
        }
        button:hover { background: rgba(255, 255, 255, 0.15); }
        label { display: flex; align-items: center; gap: 8px; cursor: pointer; }
        input[type="checkbox"] { width: 18px; height: 18px; cursor: pointer; }
      </style>
      <div class="panel">
        <h2>${className}</h2>
        <div class="row">
          <button id="increment">Count Up</button>
          <span>Counter: <strong id="counter">0</strong></span>
        </div>
        <div class="row">
          <label>
            <input type="checkbox" id="checked" />
            Toggle
          </label>
        </div>
        <p class="status" id="checked-status">server says unchecked</p>
        <p class="config" id="config-info">loading config...</p>
      </div>
    \`;

    this.shadowRoot.querySelector('#increment')?.addEventListener('click', () => {
      if (!this.podcartHost) return;
      // Signal the server to increment — the actual count happens server-side
      this.podcartHost.setMeter('counter', null);
    });

    this.shadowRoot.querySelector('#checked')?.addEventListener('change', (e) => {
      if (!this.podcartHost) return;
      this.podcartHost.setMeter('checked', e.target.checked);
    });
  }
}

if (!customElements.get('${tagName}')) {
  customElements.define('${tagName}', ${className}Ui);
}
`
  );
  console.log("✓ ui/ui.js");
}

// =============================================================================
// Mantine UI
// =============================================================================

function createMantineUI(projectPath, className, tagName, jsFileName, pluginId) {
  const uiDir = path.join(projectPath, "ui");
  const srcDir = path.join(uiDir, "src");
  fs.mkdirSync(srcDir, { recursive: true });

  // ui/package.json
  fs.writeFileSync(
    path.join(uiDir, "package.json"),
    JSON.stringify(
      {
        name: `${pluginId.toLowerCase()}-ui`,
        private: true,
        version: "1.0.0",
        type: "module",
        scripts: {
          dev: "vite",
          build: "vite build",
        },
        dependencies: {
          "@mantine/core": "7.13.2",
          "@mantine/hooks": "7.13.2",
          react: "^18.3.1",
          "react-dom": "^18.3.1",
        },
        devDependencies: {
          "@types/react": "^18.3.12",
          "@types/react-dom": "^18.3.1",
          "@vitejs/plugin-react": "^4.3.4",
          typescript: "^5.6.3",
          vite: "latest",
        },
      },
      null,
      2
    ) + "\n"
  );
  console.log("✓ ui/package.json");

  // ui/vite.config.ts
  fs.writeFileSync(
    path.join(uiDir, "vite.config.ts"),
    `import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
    plugins: [react()],
    define: {
        'process.env.NODE_ENV': JSON.stringify('production'),
    },
    build: {
        outDir: 'dist',
        cssCodeSplit: false,
        rollupOptions: {
            input: 'src/entry.tsx',
            output: {
                entryFileNames: '${jsFileName}.js',
                assetFileNames: '[name][extname]',
            },
        },
    },
});
`
  );
  console.log("✓ ui/vite.config.ts");

  // ui/tsconfig.json
  fs.writeFileSync(
    path.join(uiDir, "tsconfig.json"),
    JSON.stringify(
      {
        compilerOptions: {
          target: "ES2020",
          module: "ESNext",
          moduleResolution: "bundler",
          jsx: "react-jsx",
          strict: true,
          esModuleInterop: true,
          skipLibCheck: true,
          outDir: "dist",
        },
        include: ["src"],
      },
      null,
      2
    ) + "\n"
  );
  console.log("✓ ui/tsconfig.json");

  // ui/src/bridge.tsx
  fs.writeFileSync(
    path.join(srcDir, "bridge.tsx"),
    `import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';

interface PodcartPluginHost {
    deviceId: string;
    subscribeMeter: (
        meter: string,
        listener: (update: { value: unknown; skipLock: boolean }) => void
    ) => () => void;
    setMeter: (meter: string, value: unknown) => void;
}

const HostContext = createContext<PodcartPluginHost | null>(null);

export function HostProvider({
    host,
    children,
}: {
    host: PodcartPluginHost;
    children: React.ReactNode;
}) {
    return <HostContext.Provider value={host}>{children}</HostContext.Provider>;
}

/**
 * Drop-in replacement for useConnectedState that talks through the plugin bridge.
 * Returns [value, locked, setValue] — same shape as the original.
 */
export function usePluginMeter(meter: string): [any, boolean, (v: any) => void] {
    const host = useContext(HostContext);
    const [value, setValue] = useState<any>(0);
    const [locked, setLocked] = useState(false);
    const unlockTimer = useRef<ReturnType<typeof setTimeout>>();

    useEffect(() => {
        if (!host) return;

        const unsub = host.subscribeMeter(meter, ({ value: v, skipLock }) => {
            if (!skipLock) {
                setLocked(true);
                clearTimeout(unlockTimer.current);
                unlockTimer.current = setTimeout(() => setLocked(false), 150);
            }
            setValue(v);
        });

        return () => {
            unsub();
            clearTimeout(unlockTimer.current);
        };
    }, [host, meter]);

    const set = useCallback(
        (v: any) => {
            if (!host) return;
            setValue(v);
            host.setMeter(meter, v);
        },
        [host, meter]
    );

    return [value, locked, set];
}
`
  );
  console.log("✓ ui/src/bridge.tsx");

  // ui/src/theme.ts
  fs.writeFileSync(
    path.join(srcDir, "theme.ts"),
    `import { createTheme, MantineColorsTuple } from "@mantine/core";

const brandColor: MantineColorsTuple = [
    "#e6f6ff",
    "#d4e8fb",
    "#aacef0",
    "#7db2e6",
    "#589bde",
    "#3f8cd9",
    "#3085d8",
    "#2072c0",
    "#1365ad",
    "#00579a"
];

export const theme = createTheme({
    colors: {
        brand: brandColor,
    },
    primaryColor: 'brand',
    primaryShade: 6,
});
`
  );
  console.log("✓ ui/src/theme.ts");

  // ui/src/App.tsx
  fs.writeFileSync(
    path.join(srcDir, "App.tsx"),
    `import { Box, Button, Card, Checkbox, Group, Stack, Text } from '@mantine/core';
import { usePluginMeter } from './bridge';

export function App() {
    const [counter, , setCounter] = usePluginMeter('counter');
    const [checked, , setChecked] = usePluginMeter('checked');
    const [configInfo] = usePluginMeter('configInfo');

    return (
        <Box p="md">
            <Card withBorder p="lg">
                <Text fw={700} size="xl" mb="md">
                    ${className}
                </Text>
                <Stack gap="md">
                    <Group>
                        <Button onClick={() => setCounter(null)}>
                            Count Up
                        </Button>
                        <Text>Counter: <strong>{String(counter)}</strong></Text>
                    </Group>
                    <Checkbox
                        label="Toggle"
                        size="lg"
                        checked={Boolean(checked)}
                        onChange={(e) => setChecked(e.currentTarget.checked)}
                    />
                    <Text c="dimmed">
                        {checked ? 'server says checked' : 'server says unchecked'}
                    </Text>
                    <Text size="xs" c="dimmed" ff="monospace">
                        {String(configInfo || 'loading config...')}
                    </Text>
                </Stack>
            </Card>
        </Box>
    );
}
`
  );
  console.log("✓ ui/src/App.tsx");

  // ui/src/entry.tsx
  fs.writeFileSync(
    path.join(srcDir, "entry.tsx"),
    `import { createRoot, Root } from 'react-dom/client';
import { MantineProvider } from '@mantine/core';
import '@mantine/core/styles.css';
import { theme } from './theme';
import { HostProvider } from './bridge';
import { App } from './App';

class ${className}UI extends HTMLElement {
    private root: Root | null = null;

    connectedCallback() {
        const shadow = this.attachShadow({ mode: 'open' });

        const link = document.createElement('link');
        link.rel = 'stylesheet';
        link.href = new URL(/* @vite-ignore */ './style.css', import.meta.url).href;
        shadow.appendChild(link);

        const container = document.createElement('div');
        container.setAttribute('data-mantine-color-scheme', 'dark');
        shadow.appendChild(container);

        this.root = createRoot(container);
        this.renderApp();

        this.addEventListener('podcart-host-ready', () => this.renderApp());
    }

    disconnectedCallback() {
        this.root?.unmount();
        this.root = null;
    }

    private renderApp() {
        if (!this.root) return;

        const host = (this as any).podcartHost;
        if (!host) return;

        this.root.render(
            <MantineProvider theme={theme} defaultColorScheme="dark" cssVariablesSelector=":host">
                <HostProvider host={host}>
                    <App />
                </HostProvider>
            </MantineProvider>
        );
    }
}

if (!customElements.get('${tagName}')) {
    customElements.define('${tagName}', ${className}UI);
}
`
  );
  console.log("✓ ui/src/entry.tsx");
}
