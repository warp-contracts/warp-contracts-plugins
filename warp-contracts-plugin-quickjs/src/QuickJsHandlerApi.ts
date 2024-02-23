import { QuickJSContext, QuickJSHandle, QuickJSRuntime, QuickJSWASMModule } from 'quickjs-emscripten';
import {
  AbstractContractHandler,
  AoInteractionResult,
  ContractDefinition,
  ContractInteraction,
  EvalStateResult,
  ExecutionContext,
  InteractionData,
  InteractionResult,
  SmartWeaveGlobal,
  Tag,
  Tags
} from 'warp-contracts';
import { VARIANT_TYPE, errorEvalAndDispose } from './utils';
import { DELIMITER } from '.';
import fs from 'fs';

interface TestInput {
  function: string;
  recipient?: string;
  target?: string;
  quantity?: string;
  cast?: string;
}

interface Message {
  cron: boolean;
  data: string | Buffer;
  epoch: number;
  from: string;
  id: string | undefined;
  nonce: number;
  owner: string;
  signature: string | undefined;
  tagArray: Tags;
  tags: {
    [key: string]: string | undefined;
  };
  target: string;
  timestamp: number;
  ['Block-Height']: number;
  ['Forwarded-By']: string;
  ['Hash-Chain']: string;
}

export class QuickJsHandlerApi<State> extends AbstractContractHandler<State> {
  async maybeCallStateConstructor(
    initialState: State,
    executionContext: ExecutionContext<State, unknown>
  ): Promise<State> {
    if (this.contractDefinition.manifest?.evaluationOptions?.useConstructor) {
      throw Error('Constructor is not implemented for QuickJS');
    }
    return initialState;
  }

  constructor(
    swGlobal: SmartWeaveGlobal,
    contractDefinition: ContractDefinition<State>,
    private readonly vm: QuickJSContext,
    private readonly runtime: QuickJSRuntime,
    private readonly quickJS: QuickJSWASMModule,
    private readonly wasmMemory: Buffer | undefined
  ) {
    super(swGlobal, contractDefinition);
  }

  async handle<Input, Result>(
    executionContext: ExecutionContext<State>,
    currentResult: EvalStateResult<State>,
    interactionData: InteractionData<Input>
  ): Promise<InteractionResult<State, Result>> {
    const { interaction, interactionTx } = interactionData;

    this.swGlobal._activeTx = interactionTx;
    this.swGlobal.caller = interaction.caller;

    this.assignReadContractState(executionContext, interactionTx);
    this.assignViewContractState<Input>(executionContext);
    this.assignWrite(executionContext);
    this.assignRefreshState(executionContext);
    //TODO d
    //assertNotConstructorCall

    // should be probably somewhere in SDK
    const message = this.prepareMessage(interaction, this.swGlobal, this.contractDefinition.srcTxId);
    if (!this.wasmMemory) {
      this.init(this.swGlobal, interaction);
    }
    return this.runContractFunction(message, currentResult.state);
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

  private runContractFunction<Result>(message: Message, state: State): InteractionResult<State, Result> {
    try {
      const evalInteractionResult = this.vm.evalCode(`__handleDecorator(${JSON.stringify(message)})`);
      if (evalInteractionResult.error) {
        errorEvalAndDispose('interaction', this.logger, this.vm, evalInteractionResult.error);
      } else {
        const evalCurrentStateResult = this.vm.evalCode(`__currentState()`);
        if (evalCurrentStateResult.error) {
          errorEvalAndDispose('currentState', this.logger, this.vm, evalCurrentStateResult.error);
        } else {
          const currentState: State = this.disposeResult(evalCurrentStateResult);

          const evalOutboxResult = this.vm.evalCode(`__getOutbox()`);

          if (evalOutboxResult.error) {
            errorEvalAndDispose('outbox', this.logger, this.vm, evalOutboxResult.error);
          } else {
            const outbox: AoInteractionResult<Result> = this.disposeResult(evalOutboxResult);
            const wasmMemory = this.getWasmMemory();

            return {
              type: 'ok',
              result: outbox.Output,
              state: currentState,
              Memory: wasmMemory,
              Error: '',
              Messages: outbox.Messages,
              Spawns: outbox.Spawns,
              Output: outbox.Output
            };
          }
        }
      }
      throw new Error(`Unexpected result from contract: ${JSON.stringify(evalInteractionResult)}`);
    } catch (err: any) {
      if (err.cause?.stack.includes('ProcessError')) {
        try {
          const evalOutboxResult = this.vm.evalCode(`__getOutbox()`);
          if (evalOutboxResult.error) {
            errorEvalAndDispose('outbox', this.logger, this.vm, evalOutboxResult.error);
          } else {
            const outbox: AoInteractionResult<Result> = this.disposeResult(evalOutboxResult);
            return {
              type: 'error',
              errorMessage: err.cause.message,
              state,
              // // note: previous version was writing error message to a "result" field,
              // // which fucks-up the HandlerResult type definition -
              // // HandlerResult.result had to be declared as 'Result | string' - and that led to a poor dev exp.
              // // TODO: this might be breaking change!
              result: null as any,
              Memory: this.quickJS.getWasmMemory(),
              Error: err.cause.message,
              Messages: outbox.Messages,
              Spawns: outbox.Spawns,
              Output: outbox.Output
            };
          }
        } catch (e) {
          return {
            type: 'exception',
            errorMessage: `${(err && err.stack) || (err && err.message) || err}`,
            state,
            result: null as any
          };
        }
      } else {
        return {
          type: 'exception',
          errorMessage: `${(err && err.stack) || (err && err.message) || err}`,
          state,
          result: null as any
        };
      }
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

  disposeResult<Result>(evalResult: { value: QuickJSHandle; error?: undefined }): Result {
    const resultValue = evalResult.value;
    const stringValue = this.vm.getString(resultValue);
    const result = stringValue === 'undefined' ? undefined : JSON.parse(this.vm.getString(resultValue));
    resultValue.dispose();
    return result;
  }

  init<Input>(swGlobal: SmartWeaveGlobal, interaction: ContractInteraction<Input>): void {
    const env = {
      process: {
        id: swGlobal.contract.id,
        owner: interaction.caller,
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
            value: 'lXfdCypsU3BpYTWvupgTioLoZAEOZL2_Ihcqepz6RiQ'
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

  prepareMessage<Input>(interaction: ContractInteraction<Input>, swGlobal: SmartWeaveGlobal, srcTxId: string) {
    return {
      // to be removed??
      // input: interaction.input,
      // TODO: which of these are configurable?
      cron: false,
      data: 'Hello ao',
      epoch: 0,
      from: swGlobal.contract.id,
      id: swGlobal._activeTx?.id,
      nonce: 1,
      owner: interaction.caller,
      signature: swGlobal._activeTx?.signature,
      tagArray: [
        new Tag('Data-Protocol', 'ao'),
        new Tag('Variant', 'ao.TN.1'),
        new Tag('Type', 'Message'),
        new Tag('From-Process', swGlobal.contract.id),
        new Tag('From-Module', srcTxId),
        new Tag('Data-Protocol', 'ao'),
        new Tag('Type', 'Message')
      ],
      tags: {
        type: 'Message',
        variant: 'ao.TN.1',
        ['Data-Protocol']: 'ao',
        ['From-Module']: srcTxId,
        ['From-Process']: swGlobal.contract.id,

        // dodać tutaj recipient + target?
        ['Action']: (interaction.input as TestInput).function,
        ['Recipient']: (interaction.input as TestInput).recipient,
        ['Quantity']: (interaction.input as TestInput).quantity,
        ['Cast']: (interaction.input as TestInput).cast
      },
      target: swGlobal.transaction.target,
      timestamp: swGlobal.block.timestamp,
      ['Block-Height']: swGlobal.block.height,
      ['Forwarded-By']: 'z1pq2WzmaYnfDwvEFgUZBj48anUsxxN64ZjbWOsIn08',
      ['Hash-Chain']: 'hJ0B-0yxKxeL3IIfaIIF7Yr6bFLG2vQayaF8G0EpjbY'
    };
  }

  getWasmMemory() {
    const variantTypeBuffer = Buffer.from(JSON.stringify(VARIANT_TYPE));
    const wasmMemoryBuffer = this.quickJS.getWasmMemory().buffer;
    // @ts-ignore
    const vmPointerBuffer = Buffer.from(JSON.stringify(this.vm.ctx.value));
    // @ts-ignore
    const runtimePointerBuffer = Buffer.from(JSON.stringify(this.vm.rt.value));

    return this.joinBuffers(
      [variantTypeBuffer, vmPointerBuffer, runtimePointerBuffer, Buffer.from(wasmMemoryBuffer)],
      DELIMITER
    );
  }

  joinBuffers(buffers: Buffer[], delimiter = '|||') {
    let delimiterBuffer = Buffer.from(delimiter);

    return buffers.reduce((prev, buffer) => Buffer.concat([prev, delimiterBuffer, buffer]));
  }
}
