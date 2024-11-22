import { quote } from './quote/index.js';

class LeafProcessor {
  constructor() {
    this.root = null;
    this.reconciliation = [];
  }

  async verifyInput(leaf) {
    try {
      if (leaf.params.type) {
        const [leafType, subType, action] = leaf.params.type.split('/');
        
        if (leafType && subType && action) {
          const modulePath = `./${leafType}/${subType}/${action}.js`;
          const actionModule = await import(modulePath);
          
          if (actionModule.default && typeof actionModule.default.init === 'function') {
            actionModule.default.init(leaf.params, this.root);
          } else {
            console.log(`No valid init function found for action: ${action}`);
          }
        } else {
          console.log('Invalid type structure:', leaf.type);
        }
      } else {
        console.log('Type is missing in leaf:', leaf);
      }
    } catch (error) {
      console.error(`Error loading module for ${leaf.type}:`, error);
    }
  }

  async verifyQuoteFill(leaf) {
    const [leafType, subType, action] = leaf.params.type.split('/');
    const modulePath = `./${leafType}/${subType}/open.js`;
    const actionModule = await import(modulePath);
    actionModule.default.init(this.state, leaf, this.root, this.reconciliation);
    actionModule.default.verifyFillAmmount();
    this.reconciliation = actionModule.default.getState().reconciliation;
  }

  async processAllLeaves(root) {
    this.root = root; // Store root in the context if needed by swap functions
    for (const leaf of root) {
      await this.verifyInput(leaf);
    }
  }
}

export { LeafProcessor };