const { LoggerFactory } = require('warp-contracts');
const {
  Lifetime,
  QuickJSRuntime,
  newQuickJSWASMModule,
  newVariant,
} = require('quickjs-emscripten');

const { QuickJsHandlerApi } = require('./QuickJsHandlerApi');
const { decorateProcessFnEval } = require('./evalCode/decorator');
const { globals } = require('./evalCode/globals');
const { WasmMemoryBuffer, WasmModuleConfig } = require('./types');
const { VARIANT_TYPE, vmIntrinsics } = require('./utils');
const fs = require('fs');

const DELIMITER = '|||';

class QuickJsPlugin {
  logger = LoggerFactory.INST.create('QuickJsPlugin');
  vm;
  runtime;
  QuickJS;

  constructor(quickJsOptions) {
    this.quickJsOptions = quickJsOptions;
  }

  async process(input) {
    // input.wasmMemory = fs.readFileSync('wasmMemory.dat');
    ({
      QuickJS: this.QuickJS,
      runtime: this.runtime,
      vm: this.vm,
    } = input.wasmMemory
      ? await this.configureExistingWasmModule(input.wasmMemory)
      : await this.configureWasmModule());
    this.setRuntimeOptions();

    //TODO - co z logowaniem? LoggerFactory?
    if (!input.wasmMemory) {
      this.evalLogging();
      this.evalGlobals();
      this.evalHandleFn(input.contractSource);
    }

    return new QuickJsHandlerApi(
      input.swGlobal,
      input.contractDefinition,
      this.vm,
      this.runtime,
      this.QuickJS,
      input.wasmMemory
    );
  }

  setRuntimeOptions() {
    this.runtime.setMemoryLimit(this.quickJsOptions.memoryLimit || 1024 * 640);
    this.runtime.setMaxStackSize(
      this.quickJsOptions.maxStackSize || 1024 * 320
    );
    let interruptCycles = 0;
    this.runtime.setInterruptHandler(
      () => ++interruptCycles > (this.quickJsOptions.maxStackSize || 1024)
    );
  }

  evalLogging() {
    const logHandle = this.vm.newFunction('log', (...args) => {
      const nativeArgs = args.map(this.vm.dump);
      console.log(...nativeArgs);
    });
    const consoleHandle = this.vm.newObject();
    this.vm.setProp(consoleHandle, 'log', logHandle);
    this.vm.setProp(this.vm.global, 'console', consoleHandle);
    consoleHandle.dispose();
    logHandle.dispose();
  }

  evalGlobals() {
    const globalsResult = this.vm.evalCode(globals);
    if (globalsResult.error) {
      globalsResult.error.dispose();
      this.logger.error(
        `Globals eval failed: ${this.vm.dump(globalsResult.error)}`
      );
      throw new Error(
        `Globals eval failed: ${this.vm.dump(globalsResult.error)}`
      );
    } else {
      globalsResult.value.dispose();
    }
  }

  evalHandleFn(contractSrc) {
    const handleFnResult = this.vm.evalCode(decorateProcessFnEval(contractSrc));
    if (handleFnResult.error) {
      handleFnResult.error.dispose();
      this.logger.debug(
        `HandleFn eval failed: ${this.vm.dump(handleFnResult.error)}`
      );
      throw new Error(
        `HandleFn eval failed:${this.vm.dump(handleFnResult.error)}`
      );
    } else {
      handleFnResult.value.dispose();
    }
  }

  async configureExistingWasmModule(wasmMemory) {
    try {
      const splittedWasmMemory = this.splitBuffer(wasmMemory, DELIMITER);
      const existingVariantType =
        splittedWasmMemory[WasmMemoryBuffer.VARIANT_TYPE].toString();
      console.log(existingVariantType);
      const variantType = JSON.stringify(VARIANT_TYPE);

      if (existingVariantType != variantType) {
        throw new Error(
          `Trying to configure WASM module with non-compatible variant type. Existing variant type: ${existingVariantType}, variant type: ${variantType}.`
        );
      }
      const existingRuntimePointer = parseInt(
        splittedWasmMemory[WasmMemoryBuffer.RUNTIME_POINTER].toString()
      );
      const existingVmPointer = parseInt(
        splittedWasmMemory[WasmMemoryBuffer.VM_POINTER].toString()
      );
      const existingMemoryView = new Uint8Array(
        splittedWasmMemory[WasmMemoryBuffer.MEMORY]
      );
      const pageSize = 64 * 1024;
      const numPages = Math.ceil(
        splittedWasmMemory[WasmMemoryBuffer.MEMORY].byteLength / pageSize
      );
      const newWasmMemory = new WebAssembly.Memory({
        initial: numPages,
        maximum: 2048,
      });
      const newWasmMemoryView = new Uint8Array(newWasmMemory.buffer);
      newWasmMemoryView.set(existingMemoryView);

      const initialWasmMemory = new WebAssembly.Memory({
        initial: 256, //*65536
        maximum: 2048, //*65536
      });
      const variant = newVariant(VARIANT_TYPE, {
        wasmMemory: initialWasmMemory,
      });

      const QuickJS = await newQuickJSWASMModule(variant);

      const lifetime = new Lifetime(
        existingRuntimePointer,
        undefined,
        (runtimePointer) => {
          // @ts-ignore
          QuickJS.callbacks.deleteRuntime(runtimePointer);
          // @ts-ignore
          QuickJS.ffi.QTS_FreeRuntime(runtimePointer);
        }
      );
      const runtime = new QuickJSRuntime({
        // @ts-ignore
        module: QuickJS.module,
        // @ts-ignore
        callbacks: QuickJS.callbacks,
        // @ts-ignore
        ffi: QuickJS.ffi,
        rt: lifetime,
      });
      const vm = runtime.newContext({
        contextPointer: existingVmPointer,
        intrinsics: vmIntrinsics,
      });

      // const testRes2 = vm.unwrapResult(vm.evalCode(`add()`));
      // console.log('add result 2 (should be 200):', vm.getNumber(testRes2));
      // testRes2.dispose();
      // vm.dispose();
      // runtime.dispose();

      return {
        QuickJS,
        runtime,
        vm,
      };
    } catch (e) {
      this.logger.error(e);
      throw new Error(`Could not create WASM module from existing memory.`);
    }
  }

  async configureWasmModule() {
    const initialWasmMemory = new WebAssembly.Memory({
      initial: 256, //*65536
      maximum: 2048, //*65536
    });
    const variant = newVariant(VARIANT_TYPE, {
      wasmMemory: initialWasmMemory,
    });
    const QuickJS = await newQuickJSWASMModule(variant);
    const runtime = QuickJS.newRuntime();

    const vm = runtime.newContext({
      intrinsics: vmIntrinsics,
    });

    return {
      QuickJS,
      runtime,
      vm,
    };
  }

  splitBuffer(buffer, delimiter) {
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
  }

  type() {
    return 'quickjs';
  }
}

module.exports = { QuickJsPlugin, DELIMITER };
