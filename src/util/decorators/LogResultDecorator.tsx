export function logResult(options: {message: string, useArgs?: Record<string, number>, functionNameTransform?: (val: string) => string}) {
    return function(target: any, functionName: string, descriptor: PropertyDescriptor) {
        const originalMethod = descriptor.value;

        descriptor.value = function (...args: any[]) {
            const result = originalMethod.apply(this, args);

            // Ensure we handle both sync and async functions properly
            const handleResult = (storedData: any) => {
                const withArgsMsg = options.useArgs 
                    ? ` for [${Object.entries(options.useArgs).map(([argName, argNum]) => `${argName}: ${args[argNum]}`).join(", ")}]`
                    : '';
                
                const transformedFunctionName = options.functionNameTransform 
                    ? options.functionNameTransform(functionName) 
                    : functionName;
                
                console.log(options.message.replaceAll(FUNCTION_NAME_KEY, transformedFunctionName) + withArgsMsg, storedData);
                return storedData;
            };

            // If result is a Promise, wait for it, otherwise handle it immediately
            return result instanceof Promise ? result.then(handleResult) : handleResult(result);
        };

        return descriptor;
    }
}

export const FUNCTION_NAME_KEY = "<FUNCTION_NAME>";