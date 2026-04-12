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
};

export default config;
