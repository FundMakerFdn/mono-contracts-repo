class SeededRandom {
    constructor(seed) {
        this.seed = seed;
    }

    next() {
        // Constants for LCG
        const a = 1664525;
        const c = 1013904223;
        const m = 2 ** 32;

        this.seed = (a * this.seed + c) % m;
        return this.seed / m;
    }
}

export class PriceGenerator {
    constructor() {
        this.seedMap = new Map();
        this.basePrice = 100;
    }

    hashString(str) {
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            hash = ((hash << 5) - hash) + str.charCodeAt(i);
            hash = hash & hash;
        }
        return hash;
    }

    initializeSeedParameters(assetName) {
        this.baseSeed = this.hashString(assetName);
    }

    getPrice(assetName, date) {
        this.initializeSeedParameters(assetName);
        const timestamp = typeof date === 'string' ? new Date(date).getTime() : date;
        const hoursSinceEpoch = Math.floor(timestamp / (1000 * 60 * 60));

        let price = this.basePrice + (this.baseSeed % 900) * 1e9;
        const randomGenerator = new SeededRandom(this.baseSeed);

        for (let i = 0; i < hoursSinceEpoch; i++) {
            const random = randomGenerator.next();
            const step = random > 0.5 ? 1.01 : 0.99; // 1% step up or down
            price *= step;
        }

        return { open: price, high: price, low: price, close: price };
    }

    // @TODO implement with price db
    getOHCLInterval(assetName, startTimestamp, endTimestamp) {
        this.initializeSeedParameters(assetName);
        const timestamp = typeof endTimestamp === 'string' ? new Date(endTimestamp).getTime() : endTimestamp;
        const hoursSinceEpoch = Math.floor(timestamp / (1000 * 60 * 60));

        let price = this.basePrice + (this.baseSeed % 900) * 1e9;
        const randomGenerator = new SeededRandom(this.baseSeed);

        for (let i = 0; i < hoursSinceEpoch; i++) {
            const random = randomGenerator.next();
            const step = random > 0.5 ? 1.01 : 0.99; // 1% step up or down
            price *= step;
        }

        return { open: price, high: price, low: price, close: price };
    }

    getFirstCrossing(assetName, tickPrice, startTimestamp, endTimestamp, isCrossUpTick) {
        this.initializeSeedParameters(assetName);
        const startHours = Math.floor(startTimestamp / (1000 * 60 * 60));
        const endHours = Math.floor(endTimestamp / (1000 * 60 * 60));

        let previousPrice = null;

        for (let hour = startHours; hour <= endHours; hour++) {
            const currentTimestamp = hour * 60 * 60 * 1000;
            const { open } = this.getPrice(assetName, currentTimestamp);

            if (previousPrice !== null) {
                if ((isCrossUpTick && previousPrice <= tickPrice && open > tickPrice) ||
                    (!isCrossUpTick && previousPrice >= tickPrice && open < tickPrice)) {
                    return currentTimestamp;
                }
            }

            previousPrice = open;
        }

        return 0;
    }
}
