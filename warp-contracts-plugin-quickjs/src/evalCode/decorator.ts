export const decorateProcessFnEval = (processCode: string) => {
  return `
        ${processCode}
    
        function __handleDecorator(message) {
          const result = handle(currentState, message);
          return JSON.stringify(result);
        }
    `;
};
