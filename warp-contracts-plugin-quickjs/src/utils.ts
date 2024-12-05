import { DefaultIntrinsics, QuickJSContext, QuickJSHandle, RELEASE_SYNC } from 'quickjs-emscripten';
import { WarpLogger } from 'warp-contracts';
import { EvalError } from './types';

export const errorEvalAndDispose = (
  evalType: string,
  logger: WarpLogger,
  vm: QuickJSContext,
  evalError: QuickJSHandle
) => {
  const error = vm.dump(evalError) || vm.getString(evalError);
  evalError.dispose();
  logger.error(`${evalType} eval failed: ${JSON.stringify(error)}`);

  throw new EvalError(`${evalType} eval failed.`, {
    name: error.name,
    evalMessage: error.message,
    stack: error.stack
  });
};

export const vmIntrinsics = {
  ...DefaultIntrinsics,
  Date: false,
  Proxy: false,
  Promise: false,
  MapSet: false,
  BigFloat: false,
  BigInt: true,
  BigDecimal: false
};

export const joinBuffers = (buffers: Buffer[], delimiter: string) => {
  let delimiterBuffer = Buffer.from(delimiter);

  return buffers.reduce((prev, buffer) => Buffer.concat([prev, delimiterBuffer, buffer]));
};

export const splitBuffer = (buffer: Buffer, delimiter: string) => {
  const splitted = [];
  let start = 0;
  let indexOfElement = buffer.indexOf(delimiter, start);
  while (indexOfElement >= 0) {
    if (indexOfElement >= 0) {
      splitted.push(buffer.slice(start, indexOfElement));
    }
    start = indexOfElement + delimiter.length;
    indexOfElement = buffer.indexOf(delimiter, start);
  }
  splitted.push(buffer.slice(start));
  return splitted;
};

export const timeout = (
  ms: number,
  message: string
): { timeoutId: string | number | NodeJS.Timeout | undefined; timeoutPromise: Promise<any> } => {
  let timeoutId: string | number | NodeJS.Timeout | undefined;
  const timeoutPromise = new Promise((resolve, reject) => {
    timeoutId = setTimeout(() => {
      clearTimeout(timeoutId);
      reject(new Error(message));
    }, ms);
  });
  return { timeoutId, timeoutPromise };
};
