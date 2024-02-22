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
  RUNTIME_POINTER,
  VM_POINTER,
  MEMORY
}

export class EvalError extends Error {
  cause: any;

  constructor(message: string, { cause }: { cause: any }) {
    super(message);
    this.cause = cause;
  }
}
