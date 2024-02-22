import { getQuickJS, newQuickJSWASMModule, newVariant, RELEASE_SYNC } from 'quickjs-emscripten';

async function main() {
  // module 1
  const QuickJS1 = await getQuickJS();
  const vm1 = QuickJS1.newContext();
  const res1 = vm1.evalCode(`const x = 100;
  function test() {
    return x;
  };
  `);
  res1.value.dispose();

  const testRes = vm1.unwrapResult(vm1.evalCode(`test()`));
  console.log('test result:', vm1.getNumber(testRes));
  const mem1 = QuickJS1.getWasmMemory();
  vm1.dispose();

  // module 2
  const variant = newVariant(RELEASE_SYNC, {
    wasmMemory: mem1
  });
  const QuickJS2 = await newQuickJSWASMModule(variant);
  const vm2 = QuickJS2.newContext();
  const testRes2 = vm2.evalCode(`test()`);
  //   if (testRes2.error) {
  //     console.log('Test res 2 eval failed:', vm2.dump(testRes2.error));
  //     testRes2.error.dispose();
  //   } else {
  //     testRes2.value.dispose();
  //   }
  console.log('test result:', vm2.getNumber(testRes2));
  //   vm2.dispose();
}

main().finally();
