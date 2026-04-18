import type {Config} from '@jest/types';

const config: Config.InitialOptions = {
  transform: {
    "^.+\\.tsx?$": [
        "ts-jest", 
        {
            diagnostics: {
                ignoreCodes: [151002],
            }
        }
    ],
  },
  moduleNameMapper: {
    '^(\\.{1,2}/.*)\\.js$': '$1',
  },
  setupFilesAfterEnv: ["./jest.config.ioredis-mock.ts"],
  testPathIgnorePatterns: [
    "/node_modules/",
    "/dist/",
  ],
};

export default config;
