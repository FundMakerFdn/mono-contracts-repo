const { custodyRollupTreeBuilder } = require('./lib/custodyRollupTreeBuilder');

async function main() {
    await custodyRollupTreeBuilder();
}

main();