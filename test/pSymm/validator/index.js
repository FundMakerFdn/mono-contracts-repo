const { shouldGetPrice } = require('./lib/getPrice.test.js');

async function pSymmValidatorTest() {
    await shouldGetPrice();
}

module.exports = {
    pSymmValidatorTest
};
