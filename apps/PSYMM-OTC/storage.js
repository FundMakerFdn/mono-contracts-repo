// Generic storage class for key-value operations
// Can be later integrated with a database
class Storage {
  constructor() {
    this.data = {};
  }

  // Store a value with the given key
  put(key, value) {
    this.data[key] = value;
    return true;
  }

  // Retrieve a value by key
  get(key) {
    return this.data[key];
  }

  // Check if a key exists
  has(key) {
    return key in this.data;
  }

  // Delete a key-value pair
  delete(key) {
    if (this.has(key)) {
      delete this.data[key];
      return true;
    }
    return false;
  }

  // Get all keys
  keys() {
    return Object.keys(this.data);
  }

  // Clear all data
  clear() {
    this.data = {};
    return true;
  }
}

module.exports = { Storage };
