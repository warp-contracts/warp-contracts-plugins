import { QuickJSContext, QuickJSHandle, QuickJSRuntime, QuickJSWASMModule } from 'quickjs-emscripten';
import {AoInteractionResult, InteractionResult, LoggerFactory, QuickJsPluginMessage, Tag} from 'warp-contracts';
import { errorEvalAndDispose } from './utils';

export class QuickJsHandlerApi<State> {
  private readonly logger = LoggerFactory.INST.create('QuickJsHandlerApi');

  constructor(
    private readonly vm: QuickJSContext,
    private readonly runtime: QuickJSRuntime,
    private readonly quickJS: QuickJSWASMModule,
  ) {}

  async handle<Result>(message: QuickJsPluginMessage, env: ProcessEnv, state?: State): Promise<InteractionResult<State, Result>> {
    if (state) {
      this.initState(state);
    }
    return this.runContractFunction(message, env);
  }

  initState(state: State): void {
    const initStateResult = this.vm.evalCode(`__initState(${JSON.stringify(state)})`);
    if (initStateResult.error) {
      errorEvalAndDispose('initState', this.logger, this.vm, initStateResult.error);
    } else {
      initStateResult.value.dispose();
    }
  }

  private async runContractFunction<Result>(message: QuickJsPluginMessage, env: ProcessEnv): InteractionResult<State, Result> {
    try {
      const evalInteractionResult = this.vm.evalCode(`__handleDecorator(${JSON.stringify(message)}, ${JSON.stringify(env)})`);
      if (evalInteractionResult.error) {
        errorEvalAndDispose('interaction', this.logger, this.vm, evalInteractionResult.error);
      } else {
        const result: AoInteractionResult<Result> = this.disposeResult(evalInteractionResult);
        const state = this.currentState() as State;
        return {
          Memory: null,
          State: state,
          Error: '',
          Messages: result.Messages,
          Spawns: result.Spawns,
          Output: result.Output
        };
      }
      throw new Error(`Unexpected result from contract: ${JSON.stringify(evalInteractionResult)}`);
    } catch (err: any) {
      if (err.name.includes('ProcessError')) {
        return {
          Memory: null,
          Error: `${err.message} ${JSON.stringify(err.stack)}`,
          Messages: null,
          Spawns: null,
          Output: null
        };
      } else {
        return {
          Memory: null,
          Error: `${(err && JSON.stringify(err.stack)) || (err && err.message) || err}`,
          Messages: null,
          Spawns: null,
          Output: null
        };
      }
    }
  }

  currentBinaryState(state: State): Buffer {
    const currentState = state || this.currentState();
    return Buffer.from(JSON.stringify(currentState));
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

}

// https://cookbook_ao.g8way.io/concepts/processes.html
export type ProcessEnv = {
  Process: {
    Id: string,
    Owner: string,
    Tags: { name: string, value: string }[]
  },
  Module: {
    Id: string,
    Owner: string,
    Tags: { name: string, value: string }[]
  }
}
