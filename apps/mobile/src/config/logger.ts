import { logger, consoleTransport } from "react-native-logs";

const log = logger.createLogger({
  severity: __DEV__ ? "debug" : "info",
  transport: consoleTransport,
  transportOptions: {
    colors: {
      debug: "white",
      info: "blueBright",
      warn: "yellowBright",
      error: "redBright",
    },
  },
  levels: {
    debug: 0,
    info: 1,
    warn: 2,
    error: 3,
  },
});

export function createLogger(module: string) {
  return {
    debug: (msg: string, ...args: unknown[]) => log.debug(`[${module}] ${msg}`, ...args),
    info: (msg: string, ...args: unknown[]) => log.info(`[${module}] ${msg}`, ...args),
    warn: (msg: string, ...args: unknown[]) => log.warn(`[${module}] ${msg}`, ...args),
    error: (msg: string, ...args: unknown[]) => log.error(`[${module}] ${msg}`, ...args),
  };
}

export default log;
