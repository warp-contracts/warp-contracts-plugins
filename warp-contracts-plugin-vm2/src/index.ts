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
      console: 'off',
      sandbox: {
        SmartWeave: swGlobal,
        BigNumber: BigNumber,
        logger: logger,
        ContractError: ContractError,
        ContractAssert: function (cond, message) {
          if (!cond) throw new ContractError(message);
        },
        //https://github.com/patriksimek/vm2/issues/484#issuecomment-1327479592
        ...typedArrays
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
