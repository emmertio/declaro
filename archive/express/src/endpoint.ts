import { type DeclaroSchema, type Module, Response } from '@declaro/core'
import type {
    OperationFunction as BaseOperationFunction,
    OperationHandlerArray as BaseOperationHandlerArray,
} from 'express-openapi'
import _ from 'lodash-es'
import { type Request as ExpressRequest, type Response as ExpressResponse } from 'express'
import type { IError, PromiseOrValue } from '@declaro/core'
import type { RequestContextFactory } from './composer'

export type OperationFunction = DeclaroSchema.Modify<
    BaseOperationFunction,
    {
        apiDoc: DeclaroSchema.OperationObject
    }
>

export type OperationHandlerArray = DeclaroSchema.Modify<
    BaseOperationHandlerArray,
    {
        apiDoc: DeclaroSchema.OperationObject
    }
>

export type Operation = OperationFunction | OperationHandlerArray

export type OperationArgs<
    TInput extends DeclaroSchema.AnyObjectParameters,
    TContext,
    TOutput extends DeclaroSchema.SchemaObject<any> | DeclaroSchema.ReferenceObject,
> = {
    info: DeclaroSchema.OperationObject
    input: TInput
    response: TOutput
    context: RequestContextFactory<TContext>
}

export type OperationHandlerArgs<TInput extends DeclaroSchema.AnyObjectParameters, TContext> = {
    info: DeclaroSchema.OperationObject
    input: DeclaroSchema.OperationInput<TInput>
    context: TContext
}
export type OperationHandler<
    TInput extends DeclaroSchema.AnyObjectParameters,
    TContext,
    TOutput extends DeclaroSchema.SchemaObject<any>,
> = (args: OperationHandlerArgs<TInput, TContext>) => PromiseOrValue<DeclaroSchema.ObjectPayload<TOutput['properties']>>

export class Endpoint<
    TInput extends DeclaroSchema.AnyObjectParameters,
    TContext,
    TOutput extends DeclaroSchema.SchemaObject<any>,
> {
    private readonly _info: DeclaroSchema.OperationObject<any>
    private readonly _parameters: TInput
    private readonly _response: TOutput
    private readonly _contextFactory: RequestContextFactory<TContext>

    static create<TContext>(module: Module, info: DeclaroSchema.OperationObject) {
        return new Endpoint(module, {
            info,
            input: {},
            response: { type: 'object', properties: {} },
            context: async () => ({} as TContext),
        })
    }

    constructor(public readonly module: Module, args: OperationArgs<TInput, TContext, TOutput>) {
        this._parameters = args.input
        this._response = args.response
        this._contextFactory = args.context

        this._info = _.cloneDeep({
            ...args.info,
        })
    }

    get schema(): DeclaroSchema.OperationObject {
        const responses = this.module.application.responses

        const outputResponse = new Response(200, {
            description: 'Successful response',
        })

        let successResponse = responses.get(200) ?? outputResponse
        successResponse = successResponse.content('application/json', {
            schema: this._response,
        })
        responses.set(200, successResponse)

        // Get all responses and convert them to an openapi response schema:
        const responseSchema = [...responses.entries()].reduce((acc, [code, response]) => {
            return {
                ...acc,
                [code]: response.schema,
            }
        }, {})

        return {
            ..._.cloneDeep(this._info),
            tags: [this.module.tag.name, ...(this._info.tags ?? [])],
            responses: responseSchema,
            parameters: Object.entries(this._parameters).map(([name, schema]) => ({
                ...schema,
                name,
            })),
        }
    }

    input<TNewParams extends DeclaroSchema.AnyObjectParameters>(
        inputSchema: TNewParams,
    ): Endpoint<TNewParams, TContext, TOutput> {
        return new Endpoint(this.module, {
            info: this._info,
            input: inputSchema,
            response: this._response,
            context: this._contextFactory,
        })
    }

    output<TNewResponse extends DeclaroSchema.SchemaObject<any>>(
        responseSchema: TNewResponse,
    ): Endpoint<TInput, TContext, TNewResponse> {
        return new Endpoint(this.module, {
            info: this._info,
            input: this._parameters,
            response: responseSchema,
            context: this._contextFactory,
        })
    }

    context<TNewContext>(contextFactory: RequestContextFactory<TNewContext>): Endpoint<TInput, TNewContext, TOutput> {
        return new Endpoint(this.module, {
            info: this._info,
            input: this._parameters,
            response: this._response,
            context: contextFactory,
        })
    }

    setInfo(info: DeclaroSchema.OperationObject) {
        return new Endpoint(this.module, {
            info,
            input: this._parameters,
            response: this._response,
            context: this._contextFactory,
        })
    }

    resolve(handler: OperationHandler<TInput, TContext, TOutput>): Operation {
        const operation: Operation = async (req: ExpressRequest, res: ExpressResponse) => {
            try {
                const context = await this._contextFactory(req)
                const parameters = this.extractParameters(req)

                const response = await handler({
                    info: this.schema,
                    input: parameters,
                    context: context,
                })

                res.status(200).json({
                    data: response,
                })
            } catch (e: any) {
                const error = e as IError

                const serializedError = typeof e?.toJSON === 'function' ? e.toJSON() : e

                // This implicitly calls the toJSON method on the error if it exists
                res.status(error.code ?? 500).json({
                    error: serializedError,
                })
            }
        }
        operation.apiDoc = this.schema

        return operation
    }

    extractParameters(req: ExpressRequest): DeclaroSchema.OperationInput<TInput> {
        const parameters = {}
        for (const parameter of this.schema.parameters) {
            const value = req.query[parameter.name]
            if (value === undefined) {
                // TODO: Handle errors gracefully
                // if (parameter.required) {
                //     throw new Error(`Missing required parameter: ${parameter.name}`)
                // }
                continue
            }
            parameters[parameter.name] = this.extractParameter(req, parameter)
        }

        return parameters as DeclaroSchema.OperationInput<TInput>
    }

    extractParameter(req: ExpressRequest, parameter: DeclaroSchema.ParameterObject) {
        if (parameter.in === 'query') {
            return this.formatParameter(parameter, req.query[parameter.name])
        } else if (parameter.in === 'header') {
            return this.formatParameter(parameter, req.headers[parameter.name])
        } else if (parameter.in === 'cookie') {
            return this.formatParameter(parameter, req.cookies[parameter.name])
        } else if (parameter.in === 'path') {
            return this.formatParameter(parameter, req.params[parameter.name])
        }
    }

    protected formatParameter(parameter: DeclaroSchema.ParameterObject, value: any) {
        if ((parameter.schema as DeclaroSchema.ReferenceObject).$ref) {
            // TODO: Resolve the reference
            return value
        }

        const schema = parameter.schema as DeclaroSchema.SchemaObject<any>

        if (schema.type === 'number' || schema.type === 'integer') {
            return Number(value)
        } else if (schema.type === 'boolean') {
            return value === 'true' || value === '1'
        } else if (schema.type === 'string') {
            return value
        }
    }
}
