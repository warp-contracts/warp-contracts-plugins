import { QuickJSContext, QuickJSHandle, QuickJSRuntime, QuickJSWASMModule } from 'quickjs-emscripten';
import { AoInteractionResult, InteractionResult, LoggerFactory, QuickJsPluginMessage } from 'warp-contracts';
import { errorEvalAndDispose, joinBuffers } from './utils';
import { DELIMITER, VARIANT_TYPE } from '.';

export class QuickJsHandlerApi<State> {
  private readonly logger = LoggerFactory.INST.create(QuickJsHandlerApi.name);

  constructor(
    private readonly vm: QuickJSContext,
    private readonly runtime: QuickJSRuntime,
    private readonly quickJS: QuickJSWASMModule,
    private readonly wasmMemory?: Buffer,
    private readonly compress?: boolean
  ) {}

  async handle<Result>(message: QuickJsPluginMessage): Promise<InteractionResult<State, Result>> {
    if (!this.wasmMemory) {
      // TODO: final version
      this.init(message);
    }

    return await this.runContractFunction(message);
  }

  initState(state: State): void {
    if (!this.wasmMemory) {
      const initStateResult = this.vm.evalCode(`__initState(${JSON.stringify(state)})`);
      if (initStateResult.error) {
        errorEvalAndDispose('initState', this.logger, this.vm, initStateResult.error);
      } else {
        initStateResult.value.dispose();
      }
    }
  }

  private async runContractFunction<Result>(message: QuickJsPluginMessage): InteractionResult<State, Result> {
    try {
      const evalInteractionResult = this.vm.evalCode(`__handleDecorator(${JSON.stringify(message)})`);
      if (evalInteractionResult.error) {
        errorEvalAndDispose('interaction', this.logger, this.vm, evalInteractionResult.error);
      } else {
        const result: AoInteractionResult<Result> = this.disposeResult(evalInteractionResult);
        return {
          Memory: await this.getWasmMemory(),
          Error: '',
          Messages: result.Messages,
          Spawns: result.Spawns,
          Output: result.Output
        };
      }
      throw new Error(`Unexpected result from contract: ${JSON.stringify(evalInteractionResult)}`);
    } catch (err: any) {
      return {
        Memory: await this.getWasmMemory(),
        Error: (err.name.includes('ProcessError'))
            ? `${err.message} ${JSON.stringify(err.stack)}`
            : `${(err && JSON.stringify(err.stack)) || (err && err.message) || err}`,
        Messages: null,
        Spawns: null,
        Output: null
      }
    }
  }

  currentState() {
    const evalCurrentStateResult = this.vm.evalCode(`__currentState()`);
    if (evalCurrentStateResult.error) {
      errorEvalAndDispose('currentState', this.logger, this.vm, evalCurrentStateResult.error);
    } else {
      return this.disposeResult(evalCurrentStateResult);
    }
  }

  async dispose(): Promise<void> {
    try {
      this.vm.dispose();
      this.runtime.dispose();
    } catch (e: any) {
      this.logger.error(e);
    }
  }

  private disposeResult<Result>(evalResult: { value: QuickJSHandle; error?: undefined }): Result {
    const resultValue = evalResult.value;
    const stringValue = this.vm.getString(resultValue);
    const result = stringValue === 'undefined' ? undefined : JSON.parse(this.vm.getString(resultValue));
    resultValue.dispose();
    return result;
  }

  private init(message: QuickJsPluginMessage): void {
    // TODO: verify current env definition in AO specs
    const env = {
      process: {
        id: message.from,
        owner: message.owner,
        tags: [
          {
            name: 'Name',
            value: 'Personal AOS'
          },
          {
            name: 'Data-Protocol',
            value: message.tags['Data-Protocol']
          },
          {
            name: 'Variant',
            value: message.tags.variant
          },
          {
            name: 'Type',
            value: 'Process'
          },
          {
            name: 'Module',
            value: message.tags['From-Module']
          },
          {
            name: 'Scheduler',
            value: 'TZ7o7SIZ06ZEJ14lXwVtng1EtSx60QkPy-kh-kdAXog'
          },
          {
            name: 'SDK',
            value: 'ao'
          },
          {
            name: 'Content-Type',
            value: 'text/plain'
          }
        ]
      }
    };
    const initResult = this.vm.evalCode(`ao.init(${JSON.stringify(env)})`);
    if (initResult.error) {
      errorEvalAndDispose('init', this.logger, this.vm, initResult.error);
    } else {
      initResult.value.dispose();
    }
  }

  private async getWasmMemory() {
    // please add benchmark around the whole method and around compression itself
    let wasmMemoryBuffer: ArrayBuffer;
    wasmMemoryBuffer = this.quickJS.getWasmMemory().buffer;

    const headers = {
      // please store release/debug and sync/async info
      variantType: VARIANT_TYPE,
      // @ts-ignore
      vmPointer: this.vm.ctx.value,
      // @ts-ignore
      runtimePointer: this.vm.rt.value,
      compressed: this.compress
    };
    if (this.compress) {
      const compressionStream = new CompressionStream('gzip');
      const uint8WasmMemoryBuffer = new Uint8Array(wasmMemoryBuffer);
      const stream = new ReadableStream({
        start(controller) {
          controller.enqueue(uint8WasmMemoryBuffer);
          controller.close();
        }
      });
      const compressedStream = stream.pipeThrough(compressionStream);
      wasmMemoryBuffer = await new Response(compressedStream).arrayBuffer();
    }

    const buffers: Buffer[] = [Buffer.from(JSON.stringify(headers)), Buffer.from(wasmMemoryBuffer)];

    return joinBuffers(buffers, DELIMITER);
  }
}
