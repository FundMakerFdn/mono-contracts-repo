const { shouldGetPrice } = require('./lib/getPrice.test.js');

async function pSymmValidator() {
    await shouldGetPrice();
}

module.exports = {
    pSymmValidator
};
