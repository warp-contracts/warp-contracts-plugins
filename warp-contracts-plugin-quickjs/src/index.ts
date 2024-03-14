import {
  LoggerFactory,
  WarpPlugin,
  WarpPluginType,
  QuickJsPluginInput,
  QuickJsOptions,
  QuickJsBinaryType
} from 'warp-contracts';
import {
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
import { WasmModuleConfig } from './types';
import { vmIntrinsics } from './utils';
import { QuickJsEvaluator } from './eval/QuickJsEvaluator';

export const DELIMITER = '|||';
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
    } = await this.configureWasmModule(input.binaryType));
    this.setRuntimeOptions();

    const quickJsEvaluator = new QuickJsEvaluator(this.vm);

    quickJsEvaluator.evalGlobalsCode(globals);
    quickJsEvaluator.evalHandleFnCode(decorateProcessFn, input.contractSource);
    quickJsEvaluator.evalLogging();
    quickJsEvaluator.evalPngJS();

    return new QuickJsHandlerApi(this.vm, this.runtime, this.QuickJS);
  }

  setRuntimeOptions() {
    this.runtime.setMemoryLimit(this.quickJsOptions.memoryLimit || MEMORY_LIMIT);
    this.runtime.setMaxStackSize(this.quickJsOptions.maxStackSize || MAX_STACK_SIZE);
    let interruptCycles = 0;
    this.runtime.setInterruptHandler(
      () => ++interruptCycles > (this.quickJsOptions.interruptCycles || INTERRUPT_CYCLES)
    );
  }

  async configureWasmModule(binaryType: QuickJsBinaryType): Promise<WasmModuleConfig> {
    try {
      const initialWasmMemory = new WebAssembly.Memory({
        initial: 256, //*65536
        maximum: 2048 //*65536
      });

      // TODO: set variant depending on the binaryType
      const variant = newVariant(RELEASE_SYNC, {
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
