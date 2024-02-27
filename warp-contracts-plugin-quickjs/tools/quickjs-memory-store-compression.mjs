import { newQuickJSWASMModule, newVariant, RELEASE_SYNC } from 'quickjs-emscripten';
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
  const rt1Ptr = vm1.rt.value;
  console.log({ vm1Ptr, rt1Ptr });

  if (!fs.existsSync('tools/data')) {
    fs.mkdirSync('tools/data');
  }
  fs.writeFileSync('tools/data/ptrs.json', JSON.stringify({ vm1Ptr, rt1Ptr }));

  // storing module 1 memory in file
  const buffer = QuickJS1.getWasmMemory().buffer;

  const compressionStream = new CompressionStream('gzip');
  const uint8Buffer = new Uint8Array(buffer);
  const stream = new ReadableStream({
    start(controller) {
      controller.enqueue(uint8Buffer);
      controller.close();
    }
  });
  const compressedStream = stream.pipeThrough(compressionStream);
  const compressedBuffer = await new Response(compressedStream).arrayBuffer();

  fs.writeFileSync('tools/data/wasmMem.dat', Buffer.from(compressedBuffer));
  console.log('byteLength', Buffer.from(compressedBuffer).length);
  // it is now safe to dispose vm1 and runtime1
  vm1.dispose();
  runtime1.dispose();
}

main()
  .catch((e) => console.error(e))
  .finally();
