import { Lifetime, newQuickJSWASMModule, newVariant, QuickJSRuntime, RELEASE_SYNC } from 'quickjs-emscripten';
import { Tag } from 'warp-contracts';
import releaseSyncVariant from '@jitl/quickjs-singlefile-mjs-release-sync';
import fs from 'fs';

async function main() {
  // reading memory from file, creating new Memory instance
  // and copying contents of the first module's memory into it
  const memoryBuffer = fs.readFileSync('wasmMemory.dat');
  //   const splittedBuf = splitBuffer(Buffer.from(memoryBuffer), '|');
  //   console.log(splittedBuf);
  const variantType = splitBuffer(memoryBuffer, '|||')[0];
  console.log(variantType.toString());
  console.log(JSON.stringify(RELEASE_SYNC));
  const buf1 = splitBuffer(memoryBuffer, '|||')[3];
  const rt1Ptr = parseInt(splitBuffer(memoryBuffer, '|||')[2].toString());
  console.log(rt1Ptr);
  const vm1Ptr = parseInt(splitBuffer(memoryBuffer, '|||')[1]);

  const existingBufferView = new Uint8Array(buf1);
  const pageSize = 64 * 1024;
  const numPages = Math.ceil(buf1.byteLength / pageSize);
  const newWasmMemory = new WebAssembly.Memory({
    initial: numPages,
    maximum: 2048
  });
  const newWasmMemoryView = new Uint8Array(newWasmMemory.buffer);
  console.log('length', newWasmMemory.buffer.byteLength);

  newWasmMemoryView.set(existingBufferView);

  // module 2
  const variant2 = newVariant(RELEASE_SYNC, {
    wasmMemory: newWasmMemory
  });

  // const { rt1Ptr, vm1Ptr } = JSON.parse(fs.readFileSync('ptrs.json', 'utf-8'));
  // console.log(rt1Ptr);
  // console.log(vm1Ptr);

  const QuickJS2 = await newQuickJSWASMModule(variant2);
  console.log(QuickJS2.getWasmMemory().buffer.byteLength);

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

  const currentCounterValue2 = doCallEval(vm2);
  console.log('2', currentCounterValue2);

  currentCounterValue2.dispose();
  // vm2.dispose();
  // runtime2.dispose();
}

main()
  .catch((e) => console.error(e))
  .finally();

export function splitBuffer(b, splitWith) {
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
  console.log(ret.length);
  return ret;
}

export function doCallEval(vm, processFunction) {
  const evalResult = vm.evalCode(
    `__handleDecorator(
    ${JSON.stringify({
      // to be removed??
      // input: interaction.input,
      // TODO: which of these are configurable?
      cron: false,
      data: 'Hello ao',
      epoch: 0,
      from: '123',
      id: '123',
      nonce: 1,
      owner: 'owner',
      signature: 'signature',
      tagArray: [
        new Tag('Data-Protocol', 'ao'),
        new Tag('Variant', 'ao.TN.1'),
        new Tag('Type', 'Message'),
        new Tag('From-Process', '123'),
        new Tag('From-Module', '123'),
        new Tag('Data-Protocol', 'ao'),
        new Tag('Type', 'Message')
      ],
      tags: {
        type: 'Message',
        variant: 'ao.TN.1',
        ['Data-Protocol']: 'ao',
        ['From-Module']: '123',
        ['From-Process']: '123',

        // dodać tutaj recipient + target?
        ['Action']: 'transfer',
        ['Recipient']: 'test target',
        ['Quantity']: '10',
        ['Cast']: false
      },
      // target: swGlobal.transaction.target,
      // timestamp: swGlobal.block.timestamp,
      // ['Block-Height']: swGlobal.block.height,
      ['Forwarded-By']: 'z1pq2WzmaYnfDwvEFgUZBj48anUsxxN64ZjbWOsIn08',
      ['Hash-Chain']: 'hJ0B-0yxKxeL3IIfaIIF7Yr6bFLG2vQayaF8G0EpjbY'
    })},
    )`
  );

  if (evalResult.error) {
    const error = vm.dump(evalResult.error);
    console.log('eval failed', error);
    evalResult.error.dispose();
    throw new Error('Eval error', { cause: error });
  } else {
    const resultValue = evalResult.value;
    console.log('resultValue', resultValue);
    const stringValue = vm.getString(resultValue);
    const result = stringValue === 'undefined' ? undefined : JSON.parse(vm.getString(resultValue));
    resultValue.dispose();
    return result;
  }
}
