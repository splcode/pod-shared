import fs from "fs";
import path from "path";

export function createVanillaUI(projectPath, { className, tagName }) {
  const uiDir = path.join(projectPath, "ui");
  fs.mkdirSync(uiDir, { recursive: true });

  fs.writeFileSync(
    path.join(uiDir, "ui.js"),
    generateVanillaElement(className, tagName)
  );
  console.log("✓ ui/ui.js");
}

function generateVanillaElement(className, tagName) {
  return `class ${className}Ui extends HTMLElement {
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
        :host { display: block; font-family: system-ui, sans-serif; color: #ccc; }
        h2 { margin: 0 0 12px; }
        .row { display: flex; align-items: center; gap: 12px; margin-top: 12px; }
        .dim { color: #888; margin-top: 8px; }
        .mono { color: #666; font-family: monospace; font-size: 12px; margin-top: 12px; }
        label { display: flex; align-items: center; gap: 8px; cursor: pointer; }
      </style>
      <div>
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
        <p class="dim" id="checked-status">server says unchecked</p>
        <p class="mono" id="config-info">loading config...</p>
      </div>
    \`;

    this.shadowRoot.querySelector('#increment')?.addEventListener('click', () => {
      if (!this.podcartHost) return;
      // Fire an event to the server — the actual count happens server-side
      this.podcartHost.sendEvent({ channel: 'counter.increment' });
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
`;
}
