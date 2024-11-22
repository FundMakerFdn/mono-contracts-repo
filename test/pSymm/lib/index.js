import { shouldGetPrice } from './getPrice.test.js';

export function shouldBehaveLikeLib() {
    describe("Mock Price Library Tests", function () {
        shouldGetPrice();
    });
}
