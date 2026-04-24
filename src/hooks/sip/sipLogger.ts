const PREFIX = "[SIP]";

export function sipLog(msg: string, ...args: unknown[]) {
  if (process.env.NODE_ENV !== "production") {
    console.log(`${PREFIX} ${msg}`, ...args);
  }
}

export function sipWarn(msg: string, ...args: unknown[]) {
  console.warn(`${PREFIX} ${msg}`, ...args);
}

export function sipError(msg: string, ...args: unknown[]) {
  console.error(`${PREFIX} ${msg}`, ...args);
}
