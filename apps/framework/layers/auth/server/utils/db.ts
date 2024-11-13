import type { User } from '@prisma/client'
import { prisma } from '~/server/prisma'

export async function findUserByEmail(email: string): Promise<User | null> {
    return prisma.user.findUnique({
        where: {
            email,
        },
    })
}

export async function createUser(input: Omit<User, 'id'>): Promise<User> {
    return prisma.user.create({
        data: input,
    })
}
