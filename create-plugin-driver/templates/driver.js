export function generateDriver({ className, uiType, pluginId, tagName, jsFileName, uiTab }) {
  return `import { PodcartAbstractDriver, eventBus } from '@splcode/pod-abstract-driver';

export default class ${className} extends PodcartAbstractDriver {
  counter = 0;
  checked = false;

  async _connect() {
    this.log.info('Connected with config:', this.config);
    this._registerMeter('counter', this.counter);
    this._registerMeter('checked', this.checked);
    this._registerMeter('checkedLabel', 'server says unchecked');
    this._registerMeter('configInfo', 'Config IP: ' + (this.config && this.config.ip || 'not set'));

    // Listen for plugin UI events
    this._onPluginEvent = (event) => {
      if (event.deviceId !== this.name) return;
      if (event.channel === 'counter.increment') {
        this.counter += 1;
        this._meterEcho('counter', this.counter);
        this.log.info('Counter incremented to', this.counter);
      }
    };
    eventBus.on('plugin:event:counter.increment', this._onPluginEvent);
  }

  async _disconnect() {
    if (this._onPluginEvent) {
      eventBus.off('plugin:event:counter.increment', this._onPluginEvent);
    }
  }

  async _get(meterName) {
    switch (meterName) {
      case 'counter': return this.counter;
      case 'checked': return this.checked;
      case 'checkedLabel': return this.checked ? 'server says checked' : 'server says unchecked';
      case 'configInfo': return 'Config IP: ' + (this.config && this.config.ip || 'not set');
    }
  }

  async _set(meterName, value) {
    this.log.info('SET', meterName, value);
    switch (meterName) {
      case 'counter':
        // Also handled via commandButton in schema UI mode
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
${generateUiMethods({ className, uiType, pluginId, tagName, jsFileName, uiTab })}
}
`;
}

function generateUiMethods({ className, uiType, pluginId, tagName, jsFileName, uiTab }) {
  if (uiType === "none") {
    return `
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
  }`;
  }

  const entry = uiType === "vanilla"
    ? `ui/ui.js`
    : `ui/dist/${jsFileName}.js`;

  return `
  getUiTab() {
    return '${uiTab}';
  }

  getUiLayout() {
    return {
      type: 'pluginSurface',
      mode: 'element',
      pluginId: '${pluginId}',
      tagName: '${tagName}',
      entry: '/plugin-ui/${pluginId}/${entry}',
    };
  }`;
}
