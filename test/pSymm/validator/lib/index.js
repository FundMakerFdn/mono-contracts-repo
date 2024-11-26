const { shouldGetPrice } = require('./getPrice.test.js');

describe("Mock Price Library Tests", function () {
    shouldGetPrice();
});

module.exports = { shouldGetPrice };