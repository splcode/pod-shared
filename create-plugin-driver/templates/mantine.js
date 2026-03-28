import fs from "fs";
import path from "path";

export function createMantineUI(projectPath, { className, tagName, jsFileName, pluginId }) {
  const uiDir = path.join(projectPath, "ui");
  const srcDir = path.join(uiDir, "src");
  fs.mkdirSync(srcDir, { recursive: true });

  writeJSON(path.join(uiDir, "package.json"), {
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
  });
  console.log("✓ ui/package.json");

  writeJSON(path.join(uiDir, "tsconfig.json"), {
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
  });
  console.log("✓ ui/tsconfig.json");

  writeFile(path.join(uiDir, "vite.config.ts"), viteConfig(jsFileName));
  console.log("✓ ui/vite.config.ts");

  writeFile(path.join(srcDir, "bridge.tsx"), bridgeTsx());
  console.log("✓ ui/src/bridge.tsx");

  writeFile(path.join(srcDir, "theme.ts"), themeTsx());
  console.log("✓ ui/src/theme.ts");

  writeFile(path.join(srcDir, "App.tsx"), appTsx(className));
  console.log("✓ ui/src/App.tsx");

  writeFile(path.join(srcDir, "entry.tsx"), entryTsx(className, tagName));
  console.log("✓ ui/src/entry.tsx");
}

// --- Helpers ---

function writeFile(filePath, content) {
  fs.writeFileSync(filePath, content);
}

function writeJSON(filePath, obj) {
  fs.writeFileSync(filePath, JSON.stringify(obj, null, 2) + "\n");
}

// --- File contents ---

function viteConfig(jsFileName) {
  return `import { defineConfig } from 'vite';
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
`;
}

function bridgeTsx() {
  return `import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';

interface PodcartPluginHost {
    deviceId: string;
    subscribeMeter: (
        meter: string,
        listener: (update: { value: unknown; skipLock: boolean }) => void
    ) => () => void;
    setMeter: (meter: string, value: unknown) => void;
    sendEvent: (request: { channel: string; payload?: unknown }) => Promise<unknown>;
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

/**
 * Returns a function that sends a plugin event to the server.
 */
export function usePluginEvent(channel: string) {
    const host = useContext(HostContext);
    return useCallback(
        (payload?: unknown) => {
            if (!host) return;
            host.sendEvent({ channel, payload });
        },
        [host, channel]
    );
}
`;
}

function themeTsx() {
  return `import { createTheme, MantineColorsTuple } from "@mantine/core";

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
`;
}

function appTsx(className) {
  return `import { Button, Card, Checkbox, Group, Stack, Text } from '@mantine/core';
import { usePluginMeter, usePluginEvent } from './bridge';

export function App() {
    const [counter] = usePluginMeter('counter');
    const [checked, , setChecked] = usePluginMeter('checked');
    const [configInfo] = usePluginMeter('configInfo');
    const incrementCounter = usePluginEvent('counter.increment');

    return (
        <Card withBorder p="lg">
            <Text fw={700} size="xl" mb="md">
                ${className}
            </Text>
            <Stack gap="md">
                <Group>
                    <Button onClick={() => incrementCounter()}>
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
    );
}
`;
}

function entryTsx(className, tagName) {
  return `import { createRoot, Root } from 'react-dom/client';
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
`;
}
