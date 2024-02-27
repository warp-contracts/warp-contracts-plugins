import {
  DEBUG_SYNC,
  QuickJSContext,
  QuickJSHandle,
  QuickJSRuntime,
  QuickJSWASMModule,
  RELEASE_ASYNC,
  RELEASE_SYNC
} from 'quickjs-emscripten';
import { AoInteractionResult, InteractionResult, LoggerFactory, QuickJsPluginMessage } from 'warp-contracts';
import { VARIANT_TYPE, errorEvalAndDispose, joinBuffers } from './utils';
import { DELIMITER } from '.';

export class QuickJsHandlerApi<State> {
  protected logger = LoggerFactory.INST.create('QuickJsHandlerApi');

  constructor(
    private readonly vm: QuickJSContext,
    private readonly runtime: QuickJSRuntime,
    private readonly quickJS: QuickJSWASMModule,
    private readonly wasmMemory: Buffer | undefined
  ) {}

  async handle<Result>(message: QuickJsPluginMessage): Promise<InteractionResult<State, Result>> {
    if (!this.wasmMemory) {
      this.init(message);
    }

    return this.runContractFunction(message);
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

  private runContractFunction<Result>(message: QuickJsPluginMessage): InteractionResult<State, Result> {
    try {
      const evalOutboxResult = this.vm.evalCode(`__handleDecorator(${JSON.stringify(message)})`);
      if (evalOutboxResult.error) {
        errorEvalAndDispose('interaction', this.logger, this.vm, evalOutboxResult.error);
      } else {
        const outbox: AoInteractionResult<Result> = this.disposeResult(evalOutboxResult);
        return {
          Memory: this.getWasmMemory(),
          Error: '',
          Messages: outbox.Messages,
          Spawns: outbox.Spawns,
          Output: outbox.Output
        };
      }
      throw new Error(`Unexpected result from contract: ${JSON.stringify(evalOutboxResult)}`);
    } catch (err: any) {
      if (err.name.includes('ProcessError')) {
        return {
          Memory: this.getWasmMemory(),
          Error: `${err.message} ${JSON.stringify(err.stack)}`,
          Messages: null,
          Spawns: null,
          Output: null
        };
      } else {
        return {
          Memory: this.getWasmMemory(),
          Error: `${(err && JSON.stringify(err.stack)) || (err && err.message) || err}`,
          Messages: null,
          Spawns: null,
          Output: null
        };
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
            value: 'ao'
          },
          {
            name: 'Variant',
            value: 'ao.TN.1'
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

  private getWasmMemory() {
    const variantTypeBuffer = Buffer.from(JSON.stringify(VARIANT_TYPE));
    const wasmMemoryBuffer = this.quickJS.getWasmMemory().buffer;
    // @ts-ignore
    const vmPointerBuffer = Buffer.from(JSON.stringify(this.vm.ctx.value));
    // @ts-ignore
    const runtimePointerBuffer = Buffer.from(JSON.stringify(this.vm.rt.value));

    return joinBuffers(
      [variantTypeBuffer, vmPointerBuffer, runtimePointerBuffer, Buffer.from(wasmMemoryBuffer)],
      DELIMITER
    );
  }
}
