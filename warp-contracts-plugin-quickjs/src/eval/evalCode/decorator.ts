export const decorateProcessFn = (processCode: string) => {
  return `
        ${processCode}
    
        function __handleDecorator(message) {
          ao.clearOutbox();
          currentMessage = message;
          handle(currentState, message);
          return JSON.stringify(ao.outbox);
        }
    `;
};
