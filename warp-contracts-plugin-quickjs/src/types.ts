import { QuickJSContext, QuickJSRuntime, QuickJSVariant, QuickJSWASMModule } from 'quickjs-emscripten';

export interface WasmModuleConfig {
  QuickJS: QuickJSWASMModule;
  vm: QuickJSContext;
  runtime: QuickJSRuntime;
}

export enum WasmMemoryBuffer {
  HEADERS,
  MEMORY
}

export class EvalError extends Error {
  name: string;
  stack: any;
  evalMessage: string;

  constructor(message: string, { name, evalMessage, stack }: { name: string; evalMessage: string; stack: any }) {
    super(message);
    this.name = name;
    this.evalMessage = evalMessage;
    this.stack = stack;
  }
}

export interface WasmMemoryHeaders {
  variantType: QuickJSVariant;
  runtimePointer: number;
  vmPointer: number;
  compressed: boolean;
}
