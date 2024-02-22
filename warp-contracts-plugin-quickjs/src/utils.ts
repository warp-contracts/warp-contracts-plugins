import { DefaultIntrinsics, QuickJSContext, QuickJSHandle, QuickJSRuntime, RELEASE_SYNC } from 'quickjs-emscripten';
import { WarpLogger } from 'warp-contracts';
import { EvalError } from './types';

export const VARIANT_TYPE = RELEASE_SYNC;

export const errorEvalAndDispose = (
  evalType: string,
  logger: WarpLogger,
  vm: QuickJSContext,
  evalError: QuickJSHandle
) => {
  const error = vm.dump(evalError);
  evalError.dispose();
  logger.error(`${evalType} eval failed: ${JSON.stringify(error)}`);
  throw new EvalError(`${evalType} eval failed.`, { cause: error });
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
