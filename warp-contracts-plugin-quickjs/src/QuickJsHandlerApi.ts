import { QuickJSContext, QuickJSHandle, QuickJSRuntime, QuickJSWASMModule } from 'quickjs-emscripten';
import { AoInteractionResult, InteractionResult, LoggerFactory, QuickJsPluginMessage } from 'warp-contracts';
import { errorEvalAndDispose } from './utils';

export class QuickJsHandlerApi<State> {
  private readonly logger = LoggerFactory.INST.create('QuickJsHandlerApi');

  constructor(
    private readonly vm: QuickJSContext,
    private readonly runtime: QuickJSRuntime,
    private readonly quickJS: QuickJSWASMModule,
  ) {}

  async handle<Result>(message: QuickJsPluginMessage, state?: State): Promise<InteractionResult<State, Result>> {
    if (state) {
      this.initState(state);
    }
    return this.runContractFunction(message);
  }

  initState(state: State): void {
    const initStateResult = this.vm.evalCode(`__initState(${JSON.stringify(state)})`);
    if (initStateResult.error) {
      errorEvalAndDispose('initState', this.logger, this.vm, initStateResult.error);
    } else {
      initStateResult.value.dispose();
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
          Memory: await this.currentState(),
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
          Memory: await this.currentState(),
          Error: `${err.message} ${JSON.stringify(err.stack)}`,
          Messages: null,
          Spawns: null,
          Output: null
        };
      } else {
        return {
          Memory: await this.currentState(),
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
        id: message.From,
        owner: message.Owner,
        tags: [
          {
            name: 'Name',
            value: 'Personal AOS'
          },
          {
            name: 'Data-Protocol',
            value: message.Tags['Data-Protocol']
          },
          {
            name: 'Variant',
            value: message.Tags.variant
          },
          {
            name: 'Type',
            value: 'Process'
          },
          {
            name: 'Module',
            value: message.Tags['From-Module']
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

}
