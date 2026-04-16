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
  setupFilesAfterEnv: ["./jest.config.ioredis-mock.ts"],
};

export default config;
