declare module '@williamcr01/opencode-tps' {
    export const commands: {
        registerCommand(command: string, callback: (...args: any[]) => any): void;
    };
    export const window: {
        showInputBox(options?: any): Promise<string | undefined>;
        showWarningMessage(message: string, ...items: string[]): Promise<string | undefined>;
        showInformationMessage(message: string, ...items: string[]): Promise<string | undefined>;
        showErrorMessage(message: string, ...items: string[]): Promise<string | undefined>;
    };
    export const chat: {
        sendMessage(message: any): void;
    };
    export const workspace: {
        rootPath: string | undefined;
    };
}
