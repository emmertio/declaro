import { JsonTypeBuilder, JavaScriptTypeBuilder, type StringFormatOption, type StringOptions } from '@sinclair/typebox'

declare module '@sinclair/typebox' {
    export interface DeclaroStringOptions extends StringOptions {
        format?: 'html' | StringFormatOption
    }

    export interface TString {
        format?: 'html' | StringFormatOption
    }

    export declare class CustomTypeBuilder extends JavaScriptTypeBuilder {
        String(options?: DeclaroStringOptions): TString
    }

    declare const Type: InstanceType<typeof CustomTypeBuilder>

    export declare function String(options?: StringOptions): TString

    export { Type }
}
