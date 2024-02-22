import {
  ContractDefinition,
  ContractError,
  HandlerApi,
  JsHandlerApi,
  VM2PluginInput,
  WarpPlugin,
  WarpPluginType
} from 'warp-contracts';
import * as vm2 from 'vm2';

// 'require' to fix esbuild adding same lib in both cjs and esm format
// https://github.com/evanw/esbuild/issues/1950
// eslint-disable-next-line
const BigNumber = require('bignumber.js');
function WeakMapError() {
  this.init = function () {
    throw new Error('WeakMap is blocked due to non-deterministic results.');
  };
  this.init();
}

function WeakRefError() {
  this.init = function () {
    throw new Error('WeakRef is blocked due to non-deterministic results.');
  };
  this.init();
}

export class VM2Plugin<State> implements WarpPlugin<VM2PluginInput, HandlerApi<State>> {
  process(input: VM2PluginInput): HandlerApi<State> {
    const { normalizedSource, logger, swGlobal, contractDefinition } = input;
    const vmScript = new vm2.VMScript(normalizedSource);
    const typedArrays = {
      Int8Array: Int8Array,
      Uint8Array: Uint8Array,
      Uint8ClampedArray: Uint8ClampedArray,
      Int16Array: Int16Array,
      Uint16Array: Uint16Array,
      Int32Array: Int32Array,
      Uint32Array: Uint32Array,
      Float32Array: Float32Array,
      Float64Array: Float64Array,
      BigInt64Array: BigInt64Array,
      BigUint64Array: BigUint64Array,
      TextEncoder: TextEncoder
    };

    const vm = new vm2.NodeVM({
      console: 'inherit',
      sandbox: {
        SmartWeave: swGlobal,
        BigNumber: BigNumber,
        logger: logger,
        ContractError: ContractError,
        ContractAssert: function (cond, message) {
          if (!cond) throw new ContractError(message);
        },
        //https://github.com/patriksimek/vm2/issues/484#issuecomment-1327479592
        ...typedArrays,
        Math: (function (OriginalMath) {
          const Math = Object.create(OriginalMath);

          Math.random = () => {
            throw new Error('Math.random is blocked due to non-deterministic results.');
          };

          return Math;
        })(Math),
        Date: (function (OriginalDate) {
          function Date(year, month, day, hours, minutes, seconds, ms) {
            let date;

            switch (arguments.length) {
              case 0:
                date = new OriginalDate(swGlobal.block.timestamp * 1000);
                break;

              case 1:
                date = new OriginalDate(year);
                break;

              default:
                day = day || 1;
                hours = hours || 0;
                minutes = minutes || 0;
                seconds = seconds || 0;
                ms = ms || 0;
                date = new OriginalDate(year, month, day, hours, minutes, seconds, ms);
                break;
            }

            return date;
          }

          Date.parse = OriginalDate.parse;
          Date.UTC = OriginalDate.UTC;
          Date.toString = OriginalDate.toString;
          Date.prototype = OriginalDate.prototype;

          Date.now = function () {
            return swGlobal.block.timestamp * 1000;
          };

          return Date;
        })(Date),
        setTimeout: () => {
          throw new Error('setTimeout is blocked due to non-deterministic results.');
        },
        setInterval: () => {
          throw new Error('setInterval is blocked due to non-deterministic results.');
        },
        WeakMap: WeakMapError,
        WeakRef: WeakRefError
      },
      compiler: 'javascript',
      eval: false,
      allowAsync: true,
      wasm: false,
      wrapper: 'commonjs'
    });

    return new JsHandlerApi<State>(swGlobal, contractDefinition as ContractDefinition<State>, vm.run(vmScript));
  }

  type(): WarpPluginType {
    return 'vm2';
  }
}
