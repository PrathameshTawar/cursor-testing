declare global {
    namespace jest {
        interface Matchers<R> {
            toHaveLengthLessThanOrEqual(expected: number): R;
        }
    }
}
export {};
