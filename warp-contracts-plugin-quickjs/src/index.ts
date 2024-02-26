import { LoggerFactory, WarpPlugin, WarpPluginType, QuickJsPluginInput, QuickJsOptions } from 'warp-contracts';
import {
  Lifetime,
  QuickJSContext,
  QuickJSRuntime,
  QuickJSWASMModule,
  newQuickJSWASMModule,
  newVariant
} from 'quickjs-emscripten';
import { QuickJsHandlerApi } from './QuickJsHandlerApi';
import { decorateProcessFnEval } from './evalCode/decorator';
import { globals } from './evalCode/globals';
import { WasmMemoryBuffer, WasmModuleConfig } from './types';
import { VARIANT_TYPE, vmIntrinsics } from './utils';

export const DELIMITER = '|||';
const MEMORY_LIMIT = 1024 * 640;
const MAX_STACK_SIZE = 1024 * 320;
const INTERRUPT_CYCLES = 1024;

export class QuickJsPlugin<State> implements WarpPlugin<QuickJsPluginInput, Promise<QuickJsHandlerApi<State>>> {
  private readonly logger = LoggerFactory.INST.create('QuickJsPlugin');
  private vm: QuickJSContext;
  private runtime: QuickJSRuntime;
  private QuickJS: QuickJSWASMModule;

  constructor(private readonly quickJsOptions: QuickJsOptions) {}

  async process(input: QuickJsPluginInput): Promise<QuickJsHandlerApi<State>> {
    ({
      QuickJS: this.QuickJS,
      runtime: this.runtime,
      vm: this.vm
    } = input.wasmMemory ? await this.configureExistingWasmModule(input.wasmMemory) : await this.configureWasmModule());
    this.setRuntimeOptions();

    //TODO - co z logowaniem? LoggerFactory?
    if (!input.wasmMemory) {
      this.evalLogging();
      this.evalGlobals();
      this.evalHandleFn(input.contractSource);
    } else {
      this.evalLogging();
    }

    return new QuickJsHandlerApi(this.vm, this.runtime, this.QuickJS, input.wasmMemory);
  }

  setRuntimeOptions() {
    this.runtime.setMemoryLimit(this.quickJsOptions.memoryLimit || MEMORY_LIMIT);
    this.runtime.setMaxStackSize(this.quickJsOptions.maxStackSize || MAX_STACK_SIZE);
    let interruptCycles = 0;
    this.runtime.setInterruptHandler(
      () => ++interruptCycles > (this.quickJsOptions.interruptCycles || INTERRUPT_CYCLES)
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
      this.logger.error(`Globals eval failed: ${this.vm.dump(globalsResult.error)}`);
      throw new Error(`Globals eval failed: ${this.vm.dump(globalsResult.error)}`);
    } else {
      globalsResult.value.dispose();
    }
  }

  evalHandleFn(contractSrc: string) {
    const handleFnResult = this.vm.evalCode(decorateProcessFnEval(contractSrc));
    if (handleFnResult.error) {
      handleFnResult.error.dispose();
      this.logger.debug(`HandleFn eval failed: ${this.vm.dump(handleFnResult.error)}`);
      throw new Error(`HandleFn eval failed:${this.vm.dump(handleFnResult.error)}`);
    } else {
      handleFnResult.value.dispose();
    }
  }

  async configureExistingWasmModule(wasmMemory: Buffer): Promise<WasmModuleConfig> {
    try {
      const splittedBuffer = this.splitBuffer(wasmMemory, DELIMITER);
      const existingVariantType = splittedBuffer[WasmMemoryBuffer.VARIANT_TYPE].toString();
      const variantType = JSON.stringify(VARIANT_TYPE);

      if (existingVariantType != variantType) {
        throw new Error(
          `Trying to configure WASM module with non-compatible variant type. Existing variant type: ${existingVariantType}, variant type: ${variantType}.`
        );
      }
      const memory = splittedBuffer[WasmMemoryBuffer.MEMORY];
      const runtimePointer = parseInt(splittedBuffer[WasmMemoryBuffer.RUNTIME_POINTER].toString());
      const vmPointer = parseInt(splittedBuffer[WasmMemoryBuffer.VM_POINTER].toString());

      const existingMemoryView = new Uint8Array(memory);
      const pageSize = 64 * 1024;
      const numPages = Math.ceil(memory.byteLength / pageSize);
      const newWasmMemory = new WebAssembly.Memory({
        initial: numPages,
        maximum: 2048
      });
      const newWasmMemoryView = new Uint8Array(newWasmMemory.buffer);

      newWasmMemoryView.set(existingMemoryView);

      const variant = newVariant(VARIANT_TYPE, {
        wasmMemory: newWasmMemory
      });

      const QuickJS = await newQuickJSWASMModule(variant);
      const rt = new Lifetime(runtimePointer, undefined, (rt_ptr) => {
        //@ts-ignore
        QuickJS.callbacks.deleteRuntime(rt_ptr);
        //@ts-ignore
        QuickJS.ffi.QTS_FreeRuntime(rt_ptr);
      });
      const runtime = new QuickJSRuntime({
        //@ts-ignore
        module: QuickJS.module,
        //@ts-ignore
        callbacks: QuickJS.callbacks,
        //@ts-ignore
        ffi: QuickJS.ffi,
        //@ts-ignore
        rt
      });

      const vm = runtime.newContext({
        //@ts-ignore
        contextPointer: vmPointer,
        intrinsics: vmIntrinsics
      });

      return {
        QuickJS,
        runtime,
        vm
      };
    } catch (e) {
      this.logger.error(e);
      throw new Error(`Could not create WASM module from existing memory.`);
    }
  }

  async configureWasmModule(): Promise<WasmModuleConfig> {
    const initialWasmMemory = new WebAssembly.Memory({
      initial: 256, //*65536
      maximum: 2048 //*65536
    });
    const variant = newVariant(VARIANT_TYPE, {
      wasmMemory: initialWasmMemory
    });
    const QuickJS = await newQuickJSWASMModule(variant);
    const runtime = QuickJS.newRuntime();

    const vm = runtime.newContext({
      intrinsics: vmIntrinsics
    });

    return {
      QuickJS,
      runtime,
      vm
    };
  }

  splitBuffer(buffer: Buffer, delimiter: string) {
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

  type(): WarpPluginType {
    return 'quickjs';
  }
}
