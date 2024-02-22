import {
  DefaultIntrinsics,
  getQuickJS,
  newVariant,
  DEBUG_SYNC,
  newQuickJSWASMModule,
  RELEASE_SYNC,
  Lifetime,
  QuickJSRuntime
} from 'quickjs-emscripten';
import fs from 'fs';

const globalsCode = `
    class ProcessError extends Error {
      constructor(message) {
        super(message);
        this.name = "ProcessError";
      }
    }

    // add all stuff from https://cookbook_ao.g8way.io/references/ao.html
    let ao = {
      _version: "0.0.3",
      id: "",
      _module: "",
      authorities: [],
      _ref: 0,
      outbox: {
        Messages: [],
        Spawns: []
      },
      env: {}
    }
    
    let currentState = {};
    
    BigInt.prototype.toJSON = function () {
      return this.toString();
    };
    
    // to be called by SDK when evaluating for already cached state - same as WASM handlers
    function __initState(newState) {
      console.log('__initState', newState);
      currentState = newState;
    }
    
    // to be called by SDK after evaluating a message - same as WASM handlers
    function __currentState() {
      return JSON.stringify(currentState);
    }
    
    function __getOutbox() {
      return JSON.stringify(ao.outbox);
    }
`;

// the example smart contract code loaded from Arweave
// note: processCode MUST HAVE 'function handle(state, message, aoGlobals)'
const processCode = `
  function handle(state, message, aoGlobals) {
      console.log('handle', message, aoGlobals, state);  
      
      if (!state.hasOwnProperty('counter')) {
        state.counter = 0;
      }
      
      if (message.action == 'increment') {
        console.log('inside increment', state.counter);
        state.counter++;
        return;
      }
      
      if (message.action == 'currentValue') {
        return {
          result: state.counter
        }
      }
      
      throw new ProcessError('unknown action');
  }
`.trim();

/*const decorateProcessFn = (processCode) => {
  return `
      ${processCode}
  
      function __handleDecorator() {
        return function(messageStringified, aoGlobalsStringified) {
          console.log('handleDecorator');  
          
          // TODO: handle BigInt during parse - but how? maybe introduce some custom type "Amount"?
          const message = JSON.parse(messageStringified);
          const aoGlobals = JSON.parse(aoGlobalsStringified);
          console.log('calling original handle');
          
          const result = handle(currentState, message, aoGlobals);
          
          return JSON.stringify(result);
        }
      }
      
      __handleDecorator();
  `;
};*/

const decorateProcessFnEval = (processCode) => {
  return `
      ${processCode}
  
      function __handleDecorator(message, aoGlobals) {
        console.log('handleDecorator');  
        const result = handle(currentState, message, aoGlobals);
        return JSON.stringify(result);
      }
  `;
};

async function main() {
  const mem = new WebAssembly.Memory({
    initial: 256, //*65536
    maximum: 2048 //*65536
  });
  const variant = newVariant(RELEASE_SYNC, {
    wasmMemory: mem
  });
  const QuickJS = await newQuickJSWASMModule(variant);

  // runtime 1
  const runtime = QuickJS.newRuntime();

  // vm1
  const vm = runtime.newContext();
  // const QuickJS = await getQuickJS();

  // // 1. creating the QJS runtime with proper memory/cycles limits
  // const runtime = QuickJS.newRuntime();
  // // TODO: memoryLimit, stack size and interrupt cycles should be configurable?
  // runtime.setMemoryLimit(1024 * 640);
  // // Limit stack size
  // runtime.setMaxStackSize(1024 * 320);
  // // Interrupt computation after 1024 calls to the interrupt handler
  // let interruptCycles = 0;
  // runtime.setInterruptHandler(() => ++interruptCycles > 1024);

  // // 2. creating the QJS context with proper intrinsics
  // const vm = runtime.newContext({
  //   intrinsics: {
  //     ...DefaultIntrinsics,
  //     Date: false,
  //     Proxy: false,
  //     Promise: false,
  //     MapSet: false,
  //     BigFloat: false,
  //     BigInt: true,
  //     BigDecimal: false
  //   }
  // });

  // 3. example of registering functions from Host: registering "console.log" API
  const logHandle = vm.newFunction('log', (...args) => {
    const nativeArgs = args.map(vm.dump);
    console.log('QuickJS:', ...nativeArgs);
  });
  const consoleHandle = vm.newObject();
  vm.setProp(consoleHandle, 'log', logHandle);
  vm.setProp(vm.global, 'console', consoleHandle);
  consoleHandle.dispose();
  logHandle.dispose();

  const simpleResult = vm.evalCode(`const x = 100;
  function test() {
    return x;
  };
  `);
  simpleResult.value.dispose();

  // const wasmMemory = QuickJS.getWasmMemory();

  // const variant = newVariant(RELEASE_SYNC, {
  //   wasmMemory
  // });
  // const QuickJS2 = await newQuickJSWASMModule(variant);

  // const test = QuickJS2.unwrapResult(QuickJS2.evalCode(`test()`));
  // console.log('vm result:', QuickJS2.getNumber(test));

  // const wasmMemory2 = QuickJS2.getWasmMemory();

  // 4. evaluating globals
  console.log('evaluating globals');
  const globalsResult = vm.evalCode(globalsCode);
  if (globalsResult.error) {
    console.log('Globals eval failed:', vm.dump(globalsResult.error));
    globalsResult.error.dispose();
  } else {
    globalsResult.value.dispose();
  }

  const initStateResult = vm.evalCode(`__initState(${JSON.stringify({ counter: 666 })})`);
  if (initStateResult.error) {
    console.log('initState failed:', vm.dump(initStateResult.error));
    initStateResult.error.dispose();
  } else {
    initStateResult.value.dispose();
  }

  // 5. evaluating decorated process function

  // version with function
  /*const handleFnResult = vm.evalCode(decorateProcessFn(processCode));
  if (handleFnResult.error) {
    console.log("HandleFn eval failed:", vm.dump(handleFnResult.error));
    handleFnResult.error.dispose();
  } else {
    // note: this is a handle to the wrapped process function
    const handleFn = vm.unwrapResult(handleFnResult);
    // actually calling process function
    doCall(handleFn, vm, "increment");
    doCall(handleFn, vm, "increment");
    doCall(handleFn, vm, "increment");
    doCall(handleFn, vm, "increment");

    const currentCounterValue = doCall(handleFn, vm, "currentValue");
    console.log(currentCounterValue);

    handleFn.dispose();
  }*/

  // version with evalCode
  const handleFnResult = vm.evalCode(decorateProcessFnEval(processCode));
  if (handleFnResult.error) {
    console.log('HandleFn eval failed:', vm.dump(handleFnResult.error));
    handleFnResult.error.dispose();
  } else {
    handleFnResult.value.dispose();
  }

  // actually calling process function
  doCallEval(vm, 'increment');
  doCallEval(vm, 'increment');
  doCallEval(vm, 'increment');
  doCallEval(vm, 'increment');

  const currentCounterValue = doCallEval(vm, 'currentValue');
  console.log(currentCounterValue);

  // // 6. test error handling
  try {
    doCallEval(vm, 'foobar');
  } catch (e) {
    console.error(e);
  }

  const buffer = QuickJS.getWasmMemory().buffer;
  const vmPtr = vm.ctx.value;
  const vmPtrBuf = Buffer.from(JSON.stringify(vmPtr));
  const rtPtr = vm.rt.value;
  const rtPtrBuf = Buffer.from(JSON.stringify(rtPtr));
  let buffers = joinBuffers([Buffer.from(JSON.stringify(RELEASE_SYNC)), vmPtrBuf, rtPtrBuf, Buffer.from(buffer)]);

  const variantType = splitBuffer(buffers, '|||')[0];
  const buf1 = splitBuffer(buffers, '|||')[3];
  const rt1Ptr = parseInt(splitBuffer(buffers, '|||')[2].toString());
  const vm1Ptr = parseInt(splitBuffer(buffers, '|||')[1]);

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

  const currentCounterValue2 = doCallEval(vm, 'currentValue');
  console.log('2', currentCounterValue2);

  function doCallEval(vm, processFunction) {
    const evalResult = vm.evalCode(
      `__handleDecorator(
      ${JSON.stringify({ action: processFunction })},
      ${JSON.stringify({ owner: 'just_ppe', id: 123 })}
      )`
    );

    if (evalResult.error) {
      const error = vm.dump(evalResult.error);
      console.log('eval failed', error);
      evalResult.error.dispose();
      throw new Error('Eval error', { cause: error });
    } else {
      const resultValue = evalResult.value;
      const stringValue = vm.getString(resultValue);
      const result = stringValue === 'undefined' ? undefined : JSON.parse(vm.getString(resultValue));
      resultValue.dispose();
      return result;
    }
  }

  function doCall(handleFn, vm, processFunction) {
    const evalResult = vm.callFunction(
      handleFn,
      vm.undefined,
      vm.newString(JSON.stringify({ action: processFunction })),
      vm.newString(JSON.stringify({ owner: 'just_ppe' }))
    );

    if (evalResult.error) {
      const error = vm.dump(evalResult.error);
      console.log('eval failed', error);
      evalResult.error.dispose();
      throw new Error(error);
    } else {
      const resultValue = evalResult.value;
      const stringValue = vm.getString(resultValue);
      const result = stringValue === 'undefined' ? undefined : JSON.parse(vm.getString(resultValue));
      resultValue.dispose();
      return result;
    }
  }

  // btw: if the below throws an error, this means some
  // of earlier values was not properly disposed
  vm.dispose();
  runtime.dispose();
}

main().finally(() => console.log("I'm done here."));

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
