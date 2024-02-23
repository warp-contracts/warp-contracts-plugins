import { RELEASE_SYNC, newQuickJSWASMModule, newVariant, Lifetime, QuickJSRuntime } from 'quickjs-emscripten';
import releaseSyncVariant from '@jitl/quickjs-singlefile-mjs-release-sync';
import fs from 'fs';

async function main() {
  // module 1
  const mem1 = new WebAssembly.Memory({
    initial: 256, //*65536
    maximum: 2048 //*65536
  });
  const variant1 = newVariant(RELEASE_SYNC, {
    wasmMemory: mem1
  });
  const QuickJS1 = await newQuickJSWASMModule(variant1);

  // runtime 1
  const runtime1 = QuickJS1.newRuntime();

  // vm1
  const vm1 = runtime1.newContext();
  const res1 = vm1.evalCode(`let x = 100;
  function add() {
    x += 50;
    return x;
  };
  `);
  res1.value.dispose();
  const testRes = vm1.unwrapResult(vm1.evalCode(`add()`));
  console.log('add result (should be 150):', vm1.getNumber(testRes));
  testRes.dispose();

  // storing vm1 and runtime 1 pointers
  const vm1Ptr = vm1.ctx.value;
  const vm1PtrBuf = Buffer.from(JSON.stringify(vm1Ptr));
  const rt1Ptr = vm1.rt.value;
  const rt1PtrBuf = Buffer.from(JSON.stringify(rt1Ptr));

  // storing module 1 memory in file
  const buffer = QuickJS1.getWasmMemory().buffer;
  let buffers = joinBuffers([Buffer.from(JSON.stringify(RELEASE_SYNC)), vm1PtrBuf, rt1PtrBuf, Buffer.from(buffer)]);
  const buf1 = splitBuffer(buffers, '|||')[2];
  fs.writeFileSync('wasmMem.dat', buffers);

  // it is now safe to dispose vm1 and runtime1
  vm1.dispose();
  runtime1.dispose();

  // const memoryBuffer = fs.readFileSync('wasmMemory.dat');
  const variantType = splitBuffer(buffers, '|||')[0];

  const buf2 = splitBuffer(buffers, '|||')[3];
  const rt2Ptr = parseInt(splitBuffer(buffers, '|||')[2].toString());
  const vm2Ptr = parseInt(splitBuffer(buffers, '|||')[1]);

  const existingBufferView = new Uint8Array(buf2);
  const pageSize = 64 * 1024;
  const numPages = Math.ceil(buf2.byteLength / pageSize);
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

  const QuickJS2 = await newQuickJSWASMModule(variant2);

  // creating runtime from rt1Ptr pointer
  const rt = new Lifetime(rt2Ptr, undefined, (rt_ptr) => {
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
    contextPointer: vm2Ptr
  });

  const testRes2 = vm2.unwrapResult(vm2.evalCode(`add()`));
  console.log('add result 2 (should be 200):', vm2.getNumber(testRes2));
  testRes2.dispose();

  // const currentCounterValue2 = doCallEval(vm2);
  // console.log('2', currentCounterValue2);

  // currentCounterValue2.dispose();
}

main()
  .catch((e) => console.error(e))
  .finally();

function joinBuffers(buffers, delimiter = '|||') {
  let d = Buffer.from(delimiter);

  return buffers.reduce((prev, b) => Buffer.concat([prev, d, b]));
}

function splitBuffer(b, splitWith) {
  const ret = [];
  let s = 0;
  let i = b.indexOf(splitWith, s);
  while (i >= 0) {
    if (i >= 0) {
      ret.push(b.slice(s, i));
    }
    s = i + splitWith.length;
    i = b.indexOf(splitWith, s);
  }
  ret.push(b.slice(s));
  return ret;
}
