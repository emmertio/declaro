defineRouteMeta({
    openAPI: {
        responses: {
            '200': {
                description: 'Successful response',
                content: {
                    'application/json': {
                        schema: {
                            type: 'object',
                            properties: {
                                message: {
                                    type: 'string',
                                },
                            },
                        },
                    },
                },
            },
        },
    },
})

export default defineEventHandler((event) => {
    return {
        message: 'Hello World',
    }
})
