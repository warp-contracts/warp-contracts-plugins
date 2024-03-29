import { Lifetime, newQuickJSWASMModule, newVariant, QuickJSRuntime, RELEASE_SYNC } from 'quickjs-emscripten';
import fs from 'fs';
import Arweave from 'arweave';

const arweave = Arweave.init();

async function main() {
  // reading memory from file, creating new Memory instance
  // and copying contents of the first module's memory into it
  const memoryBuffer = fs.readFileSync('tools/outputData/wasmMem.dat');
  const existingBufferView = new Uint8Array(memoryBuffer);
  const pageSize = 64 * 1024;
  const numPages = Math.ceil(memoryBuffer.byteLength / pageSize);
  const newWasmMemory = new WebAssembly.Memory({
    initial: numPages,
    maximum: 2048
  });
  const newWasmMemoryView = new Uint8Array(newWasmMemory.buffer);
  newWasmMemoryView.set(existingBufferView);

  // module 2
  const variant2 = newVariant(RELEASE_SYNC, {
    wasmMemory: newWasmMemory
  });

  const { rt1Ptr, vm1Ptr } = JSON.parse(fs.readFileSync('tools/outputData/ptrs.json', 'utf-8'));

  const QuickJS2 = await newQuickJSWASMModule(variant2);

  // creating runtime from rt1Ptr pointer
  const rt = new Lifetime(rt1Ptr, undefined, (rt_ptr) => {
    QuickJS2.callbacks.deleteRuntime(rt_ptr);
    QuickJS2.ffi.QTS_FreeRuntime(rt_ptr);
  });
  const runtime2 = new QuickJSRuntime({
    module: QuickJS2.module,
    callbacks: QuickJS2.callbacks,
    ffi: QuickJS2.ffi,
    rt
  });

  // creating context from vm1 ptr
  const vm2 = runtime2.newContext({
    contextPointer: vm1Ptr
  });

  const testRes2 = vm2.unwrapResult(vm2.evalCode(`add()`));
  console.log('add result 2 (should be 200):', vm2.getNumber(testRes2));
  testRes2.dispose();
  vm2.dispose();
  runtime2.dispose();
}

main()
  .catch((e) => console.error(e))
  .finally();
