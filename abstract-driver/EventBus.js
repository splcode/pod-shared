import { EventEmitter } from 'node:events';
class EventBus extends EventEmitter {}
const eventBus = new EventBus();
export default eventBus;