export const asyncDecorateProcessFn = (processCode: string) => {
  return `
        ${processCode}
    
        async function __handleDecorator(message, env) {
          ao.init(env);
          currentMessage = message;
          await handle(currentState, message);
          return JSON.stringify(ao.outbox);
        }
    `;
};

export const decorateProcessFn = (processCode: string) => {
  return `
        ${processCode}
    
        function __handleDecorator(message, env) {
          ao.init(env);
          currentMessage = message;
          handle(currentState, message);
          return JSON.stringify(ao.outbox);
        }
    `;
};
