import { ContractDefinition, HandlerApi, IvmOptions, IvmPluginInput, LoggerFactory, WarpPlugin, WarpPluginType } from 'warp-contracts';
import { Context, Isolate, Reference } from 'isolated-vm';
import { configureContext, configureSandbox } from './configure-ivm';
import { IvmHandlerApi } from './IvmHandlerApi';

export class IvmPlugin<State> implements WarpPlugin<IvmPluginInput, HandlerApi<State>> {
  private readonly logger = LoggerFactory.INST.create('IvmPlugin');

  constructor(private readonly ivmOptions: IvmOptions) {}

  process(input: IvmPluginInput): HandlerApi<State> {
    const isolate = new Isolate({
      memoryLimit: this.ivmOptions.memoryLimit,
      onCatastrophicError: (message) => {
        this.logger.fatal('Catastrophic error from isolate', message);
      }
    });
    const normalizedSource = normalizeContractSource(input.contractSource);

    const context: Context = isolate.createContextSync();
    const sandbox: Reference<Record<number | string | symbol, any>> = context.global;

    configureSandbox(sandbox, input.arweave, input.swGlobal);
    configureContext(context);
    const contract: Reference = context.evalSync(normalizedSource, { reference: true });


    return new IvmHandlerApi(input.swGlobal, input.contractDefinition as ContractDefinition<State>, { isolate, context, sandbox, contract });
  }

  type(): WarpPluginType {
    return 'ivm-handler-api';
  }
}

function normalizeContractSource(contractSrc: string): string {
  // Convert from ES Module format to something we can run inside a Function.
  // Removes the `export` keyword and adds ;return handle to the end of the function.
  // Additionally it removes 'IIFE' declarations
  // (which may be generated when bundling multiple sources into one output file
  // - eg. using esbuild's "IIFE" bundle format).
  // We also assign the passed in SmartWeaveGlobal to SmartWeave, and declare
  // the ContractError exception.
  // We then use `new Function()` which we can call and get back the returned handle function
  // which has access to the per-instance globals.

  const lines = contractSrc.trim().split('\n');
  const first = lines[0];
  const last = lines[lines.length - 1];

  if (
    (/\(\s*\(\)\s*=>\s*{/g.test(first) || /\s*\(\s*function\s*\(\)\s*{/g.test(first)) &&
    /}\s*\)\s*\(\)\s*;/g.test(last)
  ) {
    lines.shift();
    lines.pop();
    contractSrc = lines.join('\n');
  }

  contractSrc = contractSrc
    .replace(/export\s+async\s+function\s+handle/gmu, 'async function handle')
    .replace(/export\s+function\s+handle/gmu, 'async function handle');

  return `
    (
      async function handleWrapper(state, action) {
        ${contractSrc}
        return await handle(state, action);
      }  
    )
    `;
}
