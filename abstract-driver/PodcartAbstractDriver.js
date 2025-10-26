import { AbstractDriver } from '@splcode/state-server';

export default class PodcartAbstractDriver extends AbstractDriver {
  /**
   * Get the data required to render a driver's component in the frontend
   * TODO: Add JSDoc object properties later
   * @returns {Object}
   */
  getUiLayout() {
    return {}; // TODO: Throw an error once this method lives on all child classes
  }

  /**
   * Get the tab a driver's component is to be rendered under
   * @returns {string}
   */
  getUiTab() {
    return 'cameras'; // TODO: Throw an error once this method lives on all child classes
  }
}