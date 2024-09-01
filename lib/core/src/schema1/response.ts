import _ from 'lodash-es'
import type { DeclaroSchema } from './types'

export type MediaRecord<T extends DeclaroSchema.AnyObjectProperties> = {
    contentType: string
    media: DeclaroSchema.MediaTypeObject<T>
}

export class Response {
    private _code: number
    private _response: DeclaroSchema.ResponseObject
    private _mediaTypes: MediaRecord<any>[]

    constructor(code: number, response: DeclaroSchema.ResponseObject) {
        this._mediaTypes = []
        const defaultDescription = code >= 200 && code < 300 ? 'Successful response' : 'Error response'

        this._code = code
        this._response = {
            ...response,
            description: response.description ?? defaultDescription,
            content: {},
        }
    }

    /**
     *
     * @param contentType The HTTP content type
     * @param media The openapi media schema defining the response type.
     * @returns An instance of the response object for chaining content types.
     */
    content(contentType: string, ...media: DeclaroSchema.MediaTypeObject<any>[]) {
        this._mediaTypes.push(...media.map((m) => ({ contentType, media: m })))

        return this
    }

    merge(response: Response) {
        _.merge(this._response, response._response)
        this._mediaTypes.push(...response._mediaTypes)

        return this
    }

    /**
     * The response code.
     *
     * Note: Read-only. This can only be initialized in the constructor.
     */
    get code() {
        return this._code
    }

    /**
     * The fully composed openapi response object.
     */
    get schema(): DeclaroSchema.ResponseObject {
        const contentTypes = this.getContentTypes()

        const response = _.cloneDeep(this._response)

        contentTypes.forEach((contentType) => {
            const media = this.getMediaForContentType(contentType)

            if (media.length > 1) {
                response.content[contentType] = {
                    schema: {
                        oneOf: media.map((m) => m.schema),
                    },
                    examples: media.reduce((acc, media) => {
                        if (media.examples) {
                            return { ...acc, ...media.examples }
                        }

                        return acc
                    }, {}),
                }
            } else if (media.length === 1) {
                response.content[contentType] = media[0]
            }
        })

        return response
    }

    protected getContentTypes() {
        return [...new Set(this._mediaTypes.map(({ contentType }) => contentType))]
    }

    protected getMediaForContentType(contentType: string) {
        return this._mediaTypes.filter((media) => media.contentType === contentType).map((c) => c.media)
    }
}
