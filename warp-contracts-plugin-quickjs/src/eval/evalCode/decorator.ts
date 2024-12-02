export const decorateProcessFn = (processCode: string) => {
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
