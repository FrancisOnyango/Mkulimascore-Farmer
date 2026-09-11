type GlobalErrorUtils = {
  setGlobalHandler: (handler: (error: Error, isFatal?: boolean) => void) => void;
};

const globals = globalThis as typeof globalThis & { ErrorUtils?: GlobalErrorUtils };

try {
  globals.ErrorUtils?.setGlobalHandler((error) => {
    console.error('Mkulima startup error', error);
  });
} catch {
  // Keep the process alive even if the host error utility is unavailable.
}
