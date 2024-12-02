import { newQuickJSWASMModule, newVariant, RELEASE_SYNC } from 'quickjs-emscripten';

const mem = new WebAssembly.Memory({
  initial: 256, //*65536
  maximum: 2048 //*65536
});
const variant = newVariant(RELEASE_SYNC, {
  wasmMemory: mem
});
const QuickJS = await newQuickJSWASMModule(variant);

const vm = QuickJS.newContext();

const fakeFileSystem = new Map([["example.txt", "Example file content"]])

// Function that simulates reading data asynchronously
const readFileHandle = vm.newFunction("readFile", (pathHandle) => {
  const path = vm.getString(pathHandle)
  const promise = vm.newPromise()
  setTimeout(() => {
    const content = fakeFileSystem.get(path)
    promise.resolve(vm.newString(content || ""))
  }, 100)
  // IMPORTANT: Once you resolve an async action inside QuickJS,
  // call runtime.executePendingJobs() to run any code that was
  // waiting on the promise or callback.
  promise.settled.then(vm.runtime.executePendingJobs)
  return promise.handle
})
readFileHandle.consume((handle) => vm.setProp(vm.global, "readFile", handle))

// Evaluate code that uses `readFile`, which returns a promise
const result = vm.evalCode(`(async () => {
  const content = await readFile('example.txt')
  return content.toUpperCase()
})()`)
const promiseHandle = vm.unwrapResult(result)

// Convert the promise handle into a native promise and await it.
// If code like this deadlocks, make sure you are calling
// runtime.executePendingJobs appropriately.
const resolvedResult = await vm.resolvePromise(promiseHandle)
promiseHandle.dispose()
const resolvedHandle = vm.unwrapResult(resolvedResult)
console.log("Result:", vm.getString(resolvedHandle))
resolvedHandle.dispose()