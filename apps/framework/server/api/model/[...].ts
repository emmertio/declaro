import { createEventHandler } from '@zenstackhq/server/nuxt'
import { RestApiHandler } from '@zenstackhq/server/api'
import { prisma } from '~/server/prisma'
import { enhance } from '@zenstackhq/runtime'

export default createEventHandler({
    handler: RestApiHandler({ endpoint: 'http://myhost/api/model' }),
    getPrisma: async (event) => {
        return enhance(prisma, {
            user: undefined,
        })
    },
})
