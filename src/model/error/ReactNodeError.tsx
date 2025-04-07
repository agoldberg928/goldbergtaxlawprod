import React, { ReactNode } from "react";

export class ReactNodeError extends Error {
    constructor(error: any) {
        super(error)
    }
    toReactNode(): ReactNode {
        return (
            <>{this.toString()}</>
        )
    }
}

export class FileUploadFailure extends ReactNodeError {
    public failures: Record<string, string>;

    constructor(failures: Record<string, string>, message?: string) {
        super([message ?? "Failed to upload files: ", ...Object.entries(failures).map(([filename, message]) => `${filename}: ${message}`)].join("\n"))
        this.failures = failures;

        // Set the prototype explicitly for better stack trace support
        Object.setPrototypeOf(this, FileUploadFailure.prototype);
    }

    toReactNode(): ReactNode {
        return (
            <>
                {this.message} <br/>
                {Object.entries(this.failures).map(([filename, message]) => `${filename}: ${message}` + (<br />))}
            </>
        )
    }
}