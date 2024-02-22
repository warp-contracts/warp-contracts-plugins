const { DefaultIntrinsics, RELEASE_SYNC } = require('quickjs-emscripten');
const { EvalError } = require('./types');

const VARIANT_TYPE = RELEASE_SYNC;

const errorEvalAndDispose = (evalType, logger, vm, evalError) => {
  const error = vm.dump(evalError);
  evalError.dispose();
  logger.error(`${evalType} eval failed: ${JSON.stringify(error)}`);
  throw new EvalError(`${evalType} eval failed.`, { cause: error });
};

const vmIntrinsics = {
  ...DefaultIntrinsics,
  Date: false,
  Proxy: false,
  Promise: false,
  MapSet: false,
  BigFloat: false,
  BigInt: true,
  BigDecimal: false,
};

module.exports = { vmIntrinsics, errorEvalAndDispose, VARIANT_TYPE };
