import { QuickJSContext, QuickJSRuntime, QuickJSWASMModule } from 'quickjs-emscripten';

export type Pointer<CType extends string> = number & {
  ctype: CType;
};
export type JSRuntimePointer = Pointer<'JSRuntime'>;
export type JSContextPointer = Pointer<'JSContext'>;

export interface WasmModuleConfig {
  QuickJS: QuickJSWASMModule;
  vm: QuickJSContext;
  runtime: QuickJSRuntime;
}

export enum WasmMemoryBuffer {
  VARIANT_TYPE,
  VM_POINTER,
  RUNTIME_POINTER,
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
