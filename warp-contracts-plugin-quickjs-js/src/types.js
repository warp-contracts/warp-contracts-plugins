const WasmMemoryBuffer = {
  VARIANT_TYPE: 0,
  RUNTIME_POINTER: 1,
  VM_POINTER: 2,
  MEMORY: 3,
};

class EvalError extends Error {
  cause;

  constructor(message, { cause }) {
    super(message);
    this.cause = cause;
  }
}

module.exports = { WasmMemoryBuffer, EvalError };
