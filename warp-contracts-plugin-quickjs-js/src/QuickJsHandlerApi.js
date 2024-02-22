const { AbstractContractHandler, Tag } = require('warp-contracts');
const { VARIANT_TYPE, errorEvalAndDispose } = require('./utils');
const { DELIMITER } = require('.');
const fs = require('fs');

class QuickJsHandlerApi extends AbstractContractHandler {
  async maybeCallStateConstructor(initialState, executionContext) {
    if (this.contractDefinition.manifest?.evaluationOptions?.useConstructor) {
      throw Error('Constructor is not implemented for QuickJS');
    }
    return initialState;
  }

  constructor(swGlobal, contractDefinition, vm, runtime, quickJS, wasmMemory) {
    super(swGlobal, contractDefinition);
    this.vm = vm;
    this.runtime = runtime;
    this.quickJS = quickJS;
    this.wasmMemory = wasmMemory;
  }

  async handle(executionContext, currentResult, interactionData) {
    const { interaction, interactionTx } = interactionData;

    this.swGlobal._activeTx = interactionTx;
    this.swGlobal.caller = interaction.caller;

    this.assignReadContractState(executionContext, interactionTx);
    this.assignViewContractState(executionContext);
    this.assignWrite(executionContext);
    this.assignRefreshState(executionContext);

    //TODO
    //assertNotConstructorCall

    // should be probably somewhere in SDK
    const message = this.prepareMessage(
      interaction,
      this.swGlobal,
      this.contractDefinition.srcTxId
    );
    if (!this.wasmMemory) {
      this.init(this.swGlobal, interaction);
    }
    return this.runContractFunction(message, currentResult.state);
  }

  initState(state) {
    if (!this.wasmMemory) {
      const initStateResult = this.vm.evalCode(
        `__initState(${JSON.stringify(state)})`
      );
      if (initStateResult.error) {
        errorEvalAndDispose(
          'initState',
          this.logger,
          this.vm,
          initStateResult.error
        );
      } else {
        initStateResult.value.dispose();
      }
    }
  }

  async runContractFunction(message, state) {
    try {
      const evalInteractionResult = this.vm.evalCode(
        `__handleDecorator(${JSON.stringify(message)})`
      );
      if (evalInteractionResult.error) {
        errorEvalAndDispose(
          'interaction',
          this.logger,
          this.vm,
          evalInteractionResult.error
        );
      } else {
        const evalCurrentStateResult = this.vm.evalCode(`__currentState()`);
        if (evalCurrentStateResult.error) {
          errorEvalAndDispose(
            'currentState',
            this.logger,
            this.vm,
            evalCurrentStateResult.error
          );
        } else {
          const currentState = this.disposeResult(evalCurrentStateResult);

          const evalOutboxResult = this.vm.evalCode(`__getOutbox()`);

          if (evalOutboxResult.error) {
            errorEvalAndDispose(
              'outbox',
              this.logger,
              this.vm,
              evalOutboxResult.error
            );
          } else {
            const outbox = this.disposeResult(evalOutboxResult);
            const wasmMemory = this.getWasmMemory();
            // fs.writeFileSync('wasmMemory.dat', wasmMemory);
            return {
              type: 'ok',
              result: outbox.Output,
              state: currentState,
              Memory: wasmMemory,
              Error: '',
              Messages: outbox.Messages,
              Spawns: outbox.Spawns,
              Output: outbox.Output,
            };
          }
        }
      }
      throw new Error(
        `Unexpected result from contract: ${JSON.stringify(
          evalInteractionResult
        )}`
      );
    } catch (err) {
      if (err.cause?.stack.includes('ProcessError')) {
        try {
          const evalOutboxResult = this.vm.evalCode(`__getOutbox()`);
          if (evalOutboxResult.error) {
            errorEvalAndDispose(
              'outbox',
              this.logger,
              this.vm,
              evalOutboxResult.error
            );
          } else {
            const outbox = this.disposeResult(evalOutboxResult);
            return {
              type: 'error',
              errorMessage: err.cause.message,
              state,
              // // note: previous version was writing error message to a "result" field,
              // // which fucks-up the HandlerResult type definition -
              // // HandlerResult.result had to be declared as 'Result | string' - and that led to a poor dev exp.
              // // TODO: this might be breaking change!
              result: null,
              Memory: this.quickJS.getWasmMemory(),
              Error: err.cause.message,
              Messages: outbox.Messages,
              Spawns: outbox.Spawns,
              Output: outbox.Output,
            };
          }
        } catch (e) {
          return {
            type: 'exception',
            errorMessage: `${
              (err && err.stack) || (err && err.message) || err
            }`,
            state,
            result: null,
          };
        }
      } else {
        return {
          type: 'exception',
          errorMessage: `${(err && err.stack) || (err && err.message) || err}`,
          state,
          result: null,
        };
      }
    }
  }

  async dispose() {
    try {
      this.vm.dispose();
      this.runtime.dispose();
    } catch (e) {
      this.logger.error(e);
    }
  }

  disposeResult(evalResult) {
    const resultValue = evalResult.value;
    const stringValue = this.vm.getString(resultValue);
    const result =
      stringValue === 'undefined'
        ? undefined
        : JSON.parse(this.vm.getString(resultValue));
    resultValue.dispose();
    return result;
  }

  init(swGlobal, interaction) {
    const env = {
      process: {
        id: swGlobal.contract.id,
        owner: interaction.caller,
        tags: [
          {
            name: 'Name',
            value: 'Personal AOS',
          },
          {
            name: 'Data-Protocol',
            value: 'ao',
          },
          {
            name: 'Variant',
            value: 'ao.TN.1',
          },
          {
            name: 'Type',
            value: 'Process',
          },
          {
            name: 'Module',
            value: 'lXfdCypsU3BpYTWvupgTioLoZAEOZL2_Ihcqepz6RiQ',
          },
          {
            name: 'Scheduler',
            value: 'TZ7o7SIZ06ZEJ14lXwVtng1EtSx60QkPy-kh-kdAXog',
          },
          {
            name: 'SDK',
            value: 'ao',
          },
          {
            name: 'Content-Type',
            value: 'text/plain',
          },
        ],
      },
    };
    const initResult = this.vm.evalCode(`ao.init(${JSON.stringify(env)})`);
    if (initResult.error) {
      errorEvalAndDispose('init', this.logger, this.vm, initResult.error);
    } else {
      initResult.value.dispose();
    }
  }

  prepareMessage(interaction, swGlobal, srcTxId) {
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
        new Tag('Type', 'Message'),
      ],
      tags: {
        type: 'Message',
        variant: 'ao.TN.1',
        ['Data-Protocol']: 'ao',
        ['From-Module']: srcTxId,
        ['From-Process']: swGlobal.contract.id,

        // dodać tutaj recipient + target?
        ['Action']: interaction.input.function,
        ['Recipient']: interaction.input.recipient,
        ['Quantity']: interaction.input.quantity,
        ['Cast']: interaction.input.cast,
      },
      target: swGlobal.transaction.target,
      timestamp: swGlobal.block.timestamp,
      ['Block-Height']: swGlobal.block.height,
      ['Forwarded-By']: 'z1pq2WzmaYnfDwvEFgUZBj48anUsxxN64ZjbWOsIn08',
      ['Hash-Chain']: 'hJ0B-0yxKxeL3IIfaIIF7Yr6bFLG2vQayaF8G0EpjbY',
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
      [
        variantTypeBuffer,
        vmPointerBuffer,
        runtimePointerBuffer,
        Buffer.from(wasmMemoryBuffer),
      ],
      DELIMITER
    );
  }

  joinBuffers(buffers, delimiter = '|||') {
    let delimiterBuffer = Buffer.from(delimiter);

    return buffers.reduce((prev, buffer) =>
      Buffer.concat([prev, delimiterBuffer, buffer])
    );
  }
}

module.exports = { QuickJsHandlerApi };
