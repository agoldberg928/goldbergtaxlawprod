export enum BlobContainerName {
    INPUT = "input",
    STATEMENTS = "statements",
    OUTPUT = "output"
}

export type ContainerClientName = `${string}-${BlobContainerName}`;

export namespace BlobContainerName {
    export function forClient(clientName: string, blobContainerName: BlobContainerName): ContainerClientName {
        return `${clientName}-${blobContainerName}`
    }
}