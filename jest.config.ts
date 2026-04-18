import type {Config} from '@jest/types';

const config: Config.InitialOptions = {
  testEnvironment: "node",
  extensionsToTreatAsEsm: [".ts"],
  transform: {
    "^.+\\.tsx?$": [
        "ts-jest", 
        {
            useESM: true,
            tsconfig: {
              module: "NodeNext",
              moduleResolution: "NodeNext",
            },
            diagnostics: {
                ignoreCodes: [151002],
            }
        }
    ],
  },
  moduleNameMapper: {
    '^(\\.{1,2}/.*)\\.js$': '$1',
  },
  testPathIgnorePatterns: [
    "/node_modules/",
    "/dist/",
  ],
};

export default config;
