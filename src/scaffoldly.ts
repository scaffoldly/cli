import { ErrorWithReturnCode } from './scaffoldly/errors';
import { Command } from './scaffoldly/command';
import { Console } from 'console';
import { isHeadless } from './scaffoldly/ui';

// Disables (node:64080) ExperimentalWarning: The Fetch API is an experimental feature. This feature could change at any time
process.emitWarning = () => {};

export const outputStream = isHeadless() ? process.stderr : process.stdout;
export const customConsole = new Console(outputStream, process.stderr);

console.log = customConsole.log;
console.info = customConsole.info;
console.warn = customConsole.warn;
console.error = customConsole.error;
console.debug = customConsole.debug;
console.clear = customConsole.clear;
console.trace = customConsole.trace;

export const run = async (): Promise<void> => {
  const command = new Command(process.argv);
  try {
    await command.run(process.argv);
    process.exit(0);
  } catch (e) {
    if (e instanceof ErrorWithReturnCode) {
      process.exit(e.returnCode);
    }
    if (e instanceof Error) {
      console.error('Error: ', e.message);
    }
    process.exit(-1);
  }
};
