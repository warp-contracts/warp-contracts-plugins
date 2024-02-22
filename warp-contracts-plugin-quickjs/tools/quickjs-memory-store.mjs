import { RELEASE_SYNC, newQuickJSWASMModule, newVariant } from 'quickjs-emscripten';
// import { splitBuffer } from './quickjs-memory-read.mjs';
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
  console.dir(vm1.ctx.value.ctype);
  const rt1PtrBuf = Buffer.from(JSON.stringify(rt1Ptr));

  console.log({ vm1Ptr, rt1Ptr });
  fs.writeFileSync('ptrs.json', JSON.stringify({ vm1Ptr, rt1Ptr }));

  // storing module 1 memory in file
  const buffer = QuickJS1.getWasmMemory().buffer;
  console.log('length', buffer.byteLength);
  let buffers = joinBuffers([Buffer.from(JSON.stringify(RELEASE_SYNC)), vm1PtrBuf, rt1PtrBuf, Buffer.from(buffer)]);
  //   const buffer2 = splitBuffer(buffersConcat.toString(), '|||')[2];
  //   const buf1 = buffersConcat.slice(0, buffersConcat.indexOf('|||'));
  // const buf1 = splitBuffer(buffersConcat, '|||')[2];
  //   const buf2 = buffersConcat.slice();
  const buf1 = splitBuffer(buffers, '|||')[2];
  console.log(buf1.length);
  fs.writeFileSync('wasmMem.dat', buffers);

  // it is now safe to dispose vm1 and runtime1
  vm1.dispose();
  runtime1.dispose();
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
