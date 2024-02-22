const decorateProcessFnEval = (processCode) => {
  return `
        ${processCode}
    
        function __handleDecorator(message) {
          const result = handle(currentState, message);
          return JSON.stringify(result);
        }
    `;
};

module.exports = { decorateProcessFnEval };
