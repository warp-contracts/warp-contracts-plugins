import { QuickJSContext } from 'quickjs-emscripten';
import { LoggerFactory } from 'warp-contracts';

export class QuickJsEvaluator {
  private readonly logger = LoggerFactory.INST.create('QuickJsEvaluator');

  constructor(private vm: QuickJSContext) {}

  evalLogging() {
    const logHandle = this.vm.newFunction('log', (...args) => {
      const nativeArgs = args.map(this.vm.dump);
      console.log(...nativeArgs);
    });
    const consoleHandle = this.vm.newObject();
    this.vm.setProp(consoleHandle, 'log', logHandle);
    this.vm.setProp(this.vm.global, 'console', consoleHandle);
    consoleHandle.dispose();
    logHandle.dispose();
  }

  evalGlobalsCode(globalsCode: string) {
    const globalsResult = this.vm.evalCode(globalsCode);
    if (globalsResult.error) {
      globalsResult.error.dispose();
      this.logger.error(`Globals eval failed: ${this.vm.dump(globalsResult.error)}`);
      throw new Error(`Globals eval failed: ${this.vm.dump(globalsResult.error)}`);
    } else {
      globalsResult.value.dispose();
    }
  }

  evalHandleFnCode(handleFn: (contractSrc: string) => string, contractSrc: string) {
    const handleFnResult = this.vm.evalCode(handleFn(contractSrc));
    if (handleFnResult.error) {
      handleFnResult.error.dispose();
      this.logger.debug(`HandleFn eval failed: ${this.vm.dump(handleFnResult.error)}`);
      throw new Error(`HandleFn eval failed:${this.vm.dump(handleFnResult.error)}`);
    } else {
      handleFnResult.value.dispose();
    }
  }
}
