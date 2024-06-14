export const decorateProcessFn = (processCode: string) => {
  return `
        ${processCode}
    
        function __handleDecorator(message) {
          ao.clearOutbox();
          currentMessage = message;
          const stateCopy = JSON.parse(JSON.stringify(currentState));
          try {
            handle(currentState, message);
          } catch (e) {
            currentState = stateCopy;
            throw e;
          }
          return JSON.stringify(ao.outbox);
        }
    `;
};
