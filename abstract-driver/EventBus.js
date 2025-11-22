import { EventEmitter } from 'node:events';
class EventBus extends EventEmitter {}
globalThis.eventBus = globalThis.eventBus || new EventBus();
export default globalThis.eventBus;