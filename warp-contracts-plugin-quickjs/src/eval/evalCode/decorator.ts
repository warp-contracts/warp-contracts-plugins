export const decorateProcessFn = (processCode: string) => {
  return `
        ${processCode}
    
        function __handleDecorator(message) {
          console.log('before handle test');
          console.log('message', message);
          console.log('test');
          handle(currentState, message);
          console.log('after handle', ao.outbox);
          return JSON.stringify(ao.outbox);
        }
    `;
};
