declare const _default: {
    preset: string;
    extensionsToTreatAsEsm: string[];
    testEnvironment: string;
    transform: {
        '^.+\\.ts$': (string | {
            useESM: boolean;
        })[];
    };
    testMatch: string[];
    testPathIgnorePatterns: string[];
    testTimeout: number;
    verbose: boolean;
    forceExit: boolean;
};
export default _default;
//# sourceMappingURL=jest.config.d.ts.map