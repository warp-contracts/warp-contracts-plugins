export const decorateProcessFnEval = (processCode: string) => {
  return `
        ${processCode}
    
        function __handleDecorator(message) {
          handle(currentState, message);
          return JSON.stringify(ao.outbox);
        }
    `;
};
