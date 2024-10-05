import { cloneDeep } from 'lodash-es'
import type { Model } from './define-model'
import { Module } from './module'
import type { DeclaroSchema } from './types'
import { Response } from './response'

export type ModuleFactory = (mod: Module) => Module | undefined

export class Application {
    private _info: DeclaroSchema.InfoObject
    private _modules: Map<string, Module>
    private _models: Map<string, Model>
    private _responses: Map<number, Response>

    constructor(info: DeclaroSchema.InfoObject) {
        this._info = info
        this._modules = new Map()
        this._models = new Map()
        this._responses = new Map()
    }

    /**
     * Get the application info (read-only). Application info can only be set in the constructor of the application.
     *
     * Note: This should be set by the application implementation. It would be dangerous for any one module to be able to change the application info for all of the others.
     */
    get info() {
        return cloneDeep(this._info)
    }

    /**
     * Define a module for the application.
     *
     * @param tag The tag info for the module, to be used in the OpenAPI schema
     * @param factory A convenience function to define the module, adding endpoints, etc.
     * @returns
     */
    defineModule(tag: DeclaroSchema.TagObject, factory?: ModuleFactory) {
        let mod = new Module(this, tag)
        const result = factory?.(mod)

        if (result instanceof Module) {
            mod = result
        } else if (!!result) {
            throw new Error('Module factory must return a Module instance or undefined')
        }

        this._modules.set(tag.name, mod)

        return mod
    }

    /**
     * Get a module by name.
     *
     * @param name The name of the module to get
     * @returns The `Module` instance for the given name
     */
    getModule(name: string): Module {
        return this._modules.get(name)
    }

    /**
     * Add models to the application.
     *
     * @param models The models to add to the application
     * @example app.addModel(User)
     * @example app.addModel(User, Post)
     * @example app.addModel(...myModels)
     * @returns The application instance
     */
    addModel(...models: Model[]) {
        models.forEach((model) => {
            this._models.set(model.name, model)
        })

        return this
    }

    /**
     * Get a model by name.
     *
     * @param name The name of the model to get
     * @returns The `Model` instance for the given name
     */
    getModel(name: string): Model {
        return this._models.get(name)
    }

    /**
     * Get all models.
     *
     * @returns All models in the application
     */
    getModels(): Model[] {
        return Array.from(this._models.values())
    }

    /**
     * Add a response to the application.
     *
     * @param code The HTTP status code for the response
     * @param response The response object
     * @returns The application instance
     */
    addResponse(...responses: Response[]) {
        responses.forEach((response) => {
            const existingResponse = this.getResponse(response.code)

            if (existingResponse) {
                existingResponse.merge(response)
            } else {
                this._responses.set(response.code, response)
            }
        })
        return this
    }

    /**
     * Get a response by status code.
     *
     * @param code The HTTP status code for the response
     * @returns The `Response` instance for the given status code
     */
    getResponse(code: number): Response {
        return this._responses.get(code)
    }

    /**
     * Get all responses. (read-only)
     *
     * @returns All responses in the application
     */
    get responses(): Map<number, Response> {
        return new Map(this._responses)
    }

    /**
     * Get all responses as a hash of keys and values.
     *
     * @returns A hash of keys and values representing all responses in the application
     */
    getResponseSchema(): DeclaroSchema.ResponsesObject {
        const responsesHash: { [key: string]: DeclaroSchema.ResponseObject } = {}
        this._responses.forEach((value, key) => {
            responsesHash[key] = value.schema
        })
        return responsesHash
    }
}
