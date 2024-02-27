import { LoggerFactory, WarpPlugin, WarpPluginType, QuickJsPluginInput, QuickJsOptions } from 'warp-contracts';
import {
  Lifetime,
  QuickJSContext,
  QuickJSRuntime,
  QuickJSWASMModule,
  RELEASE_SYNC,
  newQuickJSWASMModule,
  newVariant
} from 'quickjs-emscripten';
import { QuickJsHandlerApi } from './QuickJsHandlerApi';
import { decorateProcessFn } from './eval/evalCode/decorator';
import { globals } from './eval/evalCode/globals';
import { WasmMemoryBuffer, WasmMemoryHeaders, WasmModuleConfig } from './types';
import { splitBuffer, vmIntrinsics } from './utils';
import { QuickJsEvaluator } from './eval/QuickJsEvaluator';

export const DELIMITER = '|||';
export const VARIANT_TYPE = RELEASE_SYNC;
const MEMORY_LIMIT = 1024 * 640;
const MAX_STACK_SIZE = 1024 * 320;
const INTERRUPT_CYCLES = 1024;
const MEMORY_INITIAL_PAGE_SIZE = 64 * 1024;
const MEMORY_MAXIMUM_PAGE_SIZE = 2048;

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

    const quickJsEvaluator = new QuickJsEvaluator(this.vm);
    quickJsEvaluator.evalLogging();
    if (!input.wasmMemory) {
      quickJsEvaluator.evalGlobalsCode(globals);
      quickJsEvaluator.evalHandleFnCode(decorateProcessFn, input.contractSource);
    }

    return new QuickJsHandlerApi(this.vm, this.runtime, this.QuickJS, input.wasmMemory, this.quickJsOptions.compress);
  }

  setRuntimeOptions() {
    this.runtime.setMemoryLimit(this.quickJsOptions.memoryLimit || MEMORY_LIMIT);
    this.runtime.setMaxStackSize(this.quickJsOptions.maxStackSize || MAX_STACK_SIZE);
    let interruptCycles = 0;
    this.runtime.setInterruptHandler(
      () => ++interruptCycles > (this.quickJsOptions.interruptCycles || INTERRUPT_CYCLES)
    );
  }

  async configureExistingWasmModule(wasmMemory: Buffer): Promise<WasmModuleConfig> {
    try {
      const splittedBuffer = splitBuffer(wasmMemory, DELIMITER);
      const headers: WasmMemoryHeaders = JSON.parse(splittedBuffer[WasmMemoryBuffer.HEADERS].toString());
      const existingVariantType = JSON.stringify(headers.variantType);
      const variantType = JSON.stringify(VARIANT_TYPE);

      if (existingVariantType != variantType) {
        throw new Error(
          `Trying to configure WASM module with non-compatible variant type. Existing variant type: ${existingVariantType}, variant type: ${variantType}.`
        );
      }
      let memory: Buffer;
      memory = splittedBuffer[WasmMemoryBuffer.MEMORY];
      const runtimePointer = headers.runtimePointer;
      const vmPointer = headers.vmPointer;

      if (headers.compressed) {
        const compressedMemoryView = new Uint8Array(memory);
        const decompressionStream = new DecompressionStream('gzip');
        const compressedStream = new ReadableStream({
          start(controller) {
            controller.enqueue(compressedMemoryView);
            controller.close();
          }
        });
        const decompressedStream = compressedStream.pipeThrough(decompressionStream);
        const decompressedBuffer = await new Response(decompressedStream).arrayBuffer();
        memory = Buffer.from(decompressedBuffer);
      }

      const existingMemoryView = new Uint8Array(memory);
      const pageSize = MEMORY_INITIAL_PAGE_SIZE;
      const numPages = Math.ceil(memory.byteLength / pageSize);
      const newWasmMemory = new WebAssembly.Memory({
        initial: numPages,
        maximum: MEMORY_MAXIMUM_PAGE_SIZE
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
    } catch (e: any) {
      this.logger.error(e);
      throw new Error(`Could not create WASM module from existing memory. ${JSON.stringify(e.message)}`);
    }
  }

  async configureWasmModule(): Promise<WasmModuleConfig> {
    try {
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
    } catch (e: any) {
      this.logger.error(e);
      throw new Error(`Could not create WASM module. ${JSON.stringify(e.message)}`);
    }
  }

  type(): WarpPluginType {
    return 'quickjs';
  }
}
