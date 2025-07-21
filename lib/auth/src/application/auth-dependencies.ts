import type Redis from 'ioredis'

export interface AuthDependencies {
    redis: Promise<Redis>
}
