declare global {
    namespace jest {
        interface Matchers<R> {
            toSatisfySafeEmpty(): R;
        }
    }
}
export {};
