export const decorateProcessFn = (processCode: string) => {
  return `
        ${processCode}
    
        function __handleDecorator(message) {
          ao.clearOutbox();
          handle(currentState, message);
          return JSON.stringify(ao.outbox);
        }
    `;
};
