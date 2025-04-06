import EventEmitter from "events";

// Queue implementation
class Queue extends EventEmitter {
  constructor() {
    super();
    this.items = [];
    this.waiters = [];
  }

  push(item) {
    this.items.push(item);
    // Resolve any pending waiters
    if (this.waiters.length > 0) {
      const resolve = this.waiters.shift();
      resolve(item);
    }
  }

  async waitForUpdate() {
    // If there are already items, resolve immediately
    if (this.items.length > 0) {
      return Promise.resolve();
    }
    
    // Otherwise, create a new promise and store the resolver
    return new Promise((resolve) => {
      this.waiters.push(resolve);
    });
  }

  shift() {
    return this.items.shift();
  }

  get length() {
    return this.items.length;
  }
}

export { Queue };
