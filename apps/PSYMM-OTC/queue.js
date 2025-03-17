const EventEmitter = require("events");

// Queue implementation
class Queue extends EventEmitter {
  constructor() {
    super();
    this.items = [];
    this.setMaxListeners(100); // Increase max listeners to prevent warnings
  }

  push(item) {
    this.items.push(item);
    this.emit("update", item);
  }

  async waitForUpdate() {
    return new Promise((resolve) => {
      this.once("update", resolve);
    });
  }

  shift() {
    return this.items.shift();
  }

  get length() {
    return this.items.length;
  }
}

module.exports = { Queue };
