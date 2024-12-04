import { newQuickJSWASMModule, newVariant, RELEASE_SYNC } from 'quickjs-emscripten';
import { dryrun } from '@permaweb/aoconnect';

const mem = new WebAssembly.Memory({
  initial: 256, //*65536
  maximum: 2048 //*65536
});
const variant = newVariant(RELEASE_SYNC, {
  wasmMemory: mem
});
const QuickJS = await newQuickJSWASMModule(variant);

const vm = QuickJS.newContext();

const timeout = (ms, message) => {
  return new Promise((resolve, reject) => {
    setTimeout(() => {
      reject(new Error(message));
    }, ms);
  });
};

const readExternalHandle = vm.newFunction('readExternal', () => {
  const promise = vm.newPromise();
  readExternal()
    .then((result) => {
      promise.resolve(vm.newString(result) || '');
    })
    .catch((error) => {
      promise.reject(vm.newString(error.message) || '');
    });
  promise.settled.then(vm.runtime.executePendingJobs);
  return promise.handle;
});
readExternalHandle.consume((handle) => vm.setProp(vm.global, 'readExternal', handle));

async function readExternal() {
  const result = await Promise.race([
    fakedryrun({
      process: 'iWM-odlyQHopPECpyz465p7ED8lm5d3hyyWtijKhie4',
      tags: [{ name: 'Action', value: 'Read-Hollow' }],
      data: '1234'
    }),
    timeout(1000, 'Operation timed out after 10 seconds')
  ]);
  return result.Messages[0].Data;
}
function fakedryrun(config) {
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve({
        Messages: [{ Data: JSON.stringify({ ap: { Price: '100', Quantity: '49' } }) }]
      });
    }, 20000);
  });
}

const result = vm.evalCode(`(async () => {
  const content = await readExternal()
  return content;
})()`);
const promiseHandle = vm.unwrapResult(result);
const resolvedResult = await vm.resolvePromise(promiseHandle);
promiseHandle.dispose();

if (resolvedResult.error) {
  //   const errorMessage = vm.getString(resolvedResult.error);
  const error = vm.dump(resolvedResult) || vm.getString(resolvedResult.error);
  resolvedResult.error.dispose();
  console.log(`eval failed: ${JSON.stringify(error)}`);

  throw new EvalError(`eval failed.`, {
    name: error.name,
    evalMessage: error.message,
    stack: error.stack
  });
} else {
  const resultValue = resolvedResult.value;
  const stringValue = vm.getString(resultValue);
  const result = stringValue === 'undefined' ? undefined : JSON.parse(vm.getString(resultValue));
  resultValue.dispose();
  console.log('Result:', result);
}
