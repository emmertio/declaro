import { describe, expect, it } from 'vitest'
import { Context } from './context'

describe('Context - Circular Dependencies', () => {
    it('should handle simple circular dependencies using proxies', () => {
        class ServiceA {
            constructor(public serviceB: ServiceB) {}

            getName() {
                return 'ServiceA'
            }

            getOtherName() {
                return this.serviceB.getName()
            }
        }

        class ServiceB {
            constructor(public serviceA: ServiceA) {}

            getName() {
                return 'ServiceB'
            }

            getOtherName() {
                return this.serviceA.getName()
            }
        }

        type Scope = {
            serviceA: ServiceA
            serviceB: ServiceB
        }

        const context = new Context<Scope>()

        context.registerClass('serviceA', ServiceA, ['serviceB'])
        context.registerClass('serviceB', ServiceB, ['serviceA'])

        const serviceA = context.resolve('serviceA')
        const serviceB = context.resolve('serviceB')

        expect(serviceA).toBeInstanceOf(ServiceA)
        expect(serviceB).toBeInstanceOf(ServiceB)
        expect(serviceA.getName()).toBe('ServiceA')
        expect(serviceB.getName()).toBe('ServiceB')

        // Test that circular references work within each resolution
        expect(serviceA.serviceB).toBeInstanceOf(ServiceB)
        expect(serviceB.serviceA).toBeInstanceOf(ServiceA)
        expect(serviceA.getOtherName()).toBe('ServiceB')
        expect(serviceB.getOtherName()).toBe('ServiceA')

        // For non-singletons, separate resolve calls should create different instances
        expect(serviceA.serviceB).not.toBe(serviceB)
        expect(serviceB.serviceA).not.toBe(serviceA)

        // But with a shared resolution context, they should be the same instances
        const resolutionContext = {}
        const serviceA2 = context.resolve('serviceA', { resolutionContext })
        const serviceB2 = context.resolve('serviceB', { resolutionContext })

        expect(serviceA2.serviceB).toBe(serviceB2)
        expect(serviceB2.serviceA).toBe(serviceA2)
    })

    it('should handle complex circular dependencies with multiple services', () => {
        class ServiceA {
            constructor(public serviceB: ServiceB, public serviceC: ServiceC) {}

            getName() {
                return 'ServiceA'
            }
        }

        class ServiceB {
            constructor(public serviceC: ServiceC) {}

            getName() {
                return 'ServiceB'
            }
        }

        class ServiceC {
            constructor(public serviceA: ServiceA) {}

            getName() {
                return 'ServiceC'
            }
        }

        type Scope = {
            serviceA: ServiceA
            serviceB: ServiceB
            serviceC: ServiceC
        }

        const context = new Context<Scope>()

        context.registerClass('serviceA', ServiceA, ['serviceB', 'serviceC'])
        context.registerClass('serviceB', ServiceB, ['serviceC'])
        context.registerClass('serviceC', ServiceC, ['serviceA'])

        const serviceA = context.resolve('serviceA')
        const serviceB = context.resolve('serviceB')
        const serviceC = context.resolve('serviceC')

        expect(serviceA).toBeInstanceOf(ServiceA)
        expect(serviceB).toBeInstanceOf(ServiceB)
        expect(serviceC).toBeInstanceOf(ServiceC)

        // Test that all circular references are properly resolved within each resolution
        expect(serviceA.serviceB).toBeInstanceOf(ServiceB)
        expect(serviceA.serviceC).toBeInstanceOf(ServiceC)
        expect(serviceB.serviceC).toBeInstanceOf(ServiceC)
        expect(serviceC.serviceA).toBeInstanceOf(ServiceA)

        // For non-singletons, separate resolve calls create different instances
        expect(serviceA.serviceB).not.toBe(serviceB)
        expect(serviceA.serviceC).not.toBe(serviceC)
        expect(serviceB.serviceC).not.toBe(serviceC)
        expect(serviceC.serviceA).not.toBe(serviceA)

        // Test that methods can be called on the circular dependencies
        expect(serviceA.getName()).toBe('ServiceA')
        expect(serviceB.getName()).toBe('ServiceB')
        expect(serviceC.getName()).toBe('ServiceC')
    })

    it('should handle circular dependencies with singletons', () => {
        class ServiceA {
            constructor(public serviceB: ServiceB) {}

            getName() {
                return 'ServiceA'
            }
        }

        class ServiceB {
            constructor(public serviceA: ServiceA) {}

            getName() {
                return 'ServiceB'
            }
        }

        type Scope = {
            serviceA: ServiceA
            serviceB: ServiceB
        }

        const context = new Context<Scope>()

        context.registerClass('serviceA', ServiceA, ['serviceB'], { singleton: true })
        context.registerClass('serviceB', ServiceB, ['serviceA'], { singleton: true })

        const serviceA1 = context.resolve('serviceA')
        const serviceB1 = context.resolve('serviceB')
        const serviceA2 = context.resolve('serviceA')
        const serviceB2 = context.resolve('serviceB')

        // Test that singletons work with circular dependencies
        expect(serviceA1).toBe(serviceA2)
        expect(serviceB1).toBe(serviceB2)
        expect(serviceA1.serviceB).toBe(serviceB1)
        expect(serviceB1.serviceA).toBe(serviceA1)
    })

    it('should handle circular dependencies with factory functions', () => {
        type ServiceA = { name: string; serviceB: ServiceB }
        type ServiceB = { name: string; serviceA: ServiceA }

        type Scope = {
            serviceA: ServiceA
            serviceB: ServiceB
        }

        const context = new Context<Scope>()

        context.registerFactory(
            'serviceA',
            (serviceB: ServiceB) => ({
                name: 'ServiceA',
                serviceB,
            }),
            ['serviceB'],
        )

        context.registerFactory(
            'serviceB',
            (serviceA: ServiceA) => ({
                name: 'ServiceB',
                serviceA,
            }),
            ['serviceA'],
        )

        const serviceA = context.resolve('serviceA')
        const serviceB = context.resolve('serviceB')

        expect(serviceA.name).toBe('ServiceA')
        expect(serviceB.name).toBe('ServiceB')
        expect(serviceA.serviceB).not.toBe(serviceB)
        expect(serviceB.serviceA).not.toBe(serviceA)

        // But circular references should work within each resolution
        expect(serviceA.serviceB.name).toBe('ServiceB')
        expect(serviceB.serviceA.name).toBe('ServiceA')
    })

    it('should handle mixed circular dependencies with classes and factories', () => {
        type OrderService = { name: string; userService: UserService; getOrdersByUserId: (userId: string) => string[] }

        class UserService {
            constructor(public orderService: OrderService) {}

            getUserOrders(userId: string) {
                return this.orderService.getOrdersByUserId(userId)
            }

            getName() {
                return 'UserService'
            }
        }

        type Scope = {
            userService: UserService
            orderService: OrderService
        }

        const context = new Context<Scope>()

        context.registerClass('userService', UserService, ['orderService'])

        context.registerFactory(
            'orderService',
            (userService: UserService) => ({
                name: 'OrderService',
                userService,
                getOrdersByUserId: (userId: string) => [`Order 1 for ${userId}`, `Order 2 for ${userId}`],
            }),
            ['userService'],
        )

        const userService = context.resolve('userService')
        const orderService = context.resolve('orderService')

        expect(userService).toBeInstanceOf(UserService)
        expect(userService.getName()).toBe('UserService')
        expect(orderService.name).toBe('OrderService')
        expect(userService.orderService).not.toBe(orderService)
        expect(orderService.userService).not.toBe(userService)

        // But circular references should work within each resolution
        expect(userService.orderService.name).toBe('OrderService')
        expect(orderService.userService.getName()).toBe('UserService')
        expect(userService.getUserOrders('user123')).toEqual(['Order 1 for user123', 'Order 2 for user123'])
    })

    it('should handle circular dependencies with eager initialization', async () => {
        class ServiceA {
            constructor(public serviceB: ServiceB) {}

            getName() {
                return 'ServiceA'
            }
        }

        class ServiceB {
            constructor(public serviceA: ServiceA) {}

            getName() {
                return 'ServiceB'
            }
        }

        type Scope = {
            serviceA: ServiceA
            serviceB: ServiceB
        }

        const context = new Context<Scope>()

        context.registerClass('serviceA', ServiceA, ['serviceB'], { eager: true })
        context.registerClass('serviceB', ServiceB, ['serviceA'], { eager: true })

        // Initialize eager dependencies
        await context.initializeEagerDependencies()

        const serviceA = context.resolve('serviceA')
        const serviceB = context.resolve('serviceB')

        expect(serviceA).toBeInstanceOf(ServiceA)
        expect(serviceB).toBeInstanceOf(ServiceB)
        expect(serviceA.serviceB).toBe(serviceB)
        expect(serviceB.serviceA).toBe(serviceA)
    })

    it('should handle circular dependencies with registerFactory creating class instances', () => {
        class ServiceA {
            constructor(public serviceB: ServiceB) {}

            getName() {
                return 'ServiceA'
            }

            getOtherName() {
                return this.serviceB.getName()
            }
        }

        class ServiceB {
            constructor(public serviceA: ServiceA) {}

            getName() {
                return 'ServiceB'
            }

            getOtherName() {
                return this.serviceA.getName()
            }
        }

        type Scope = {
            serviceA: ServiceA
            serviceB: ServiceB
        }

        const context = new Context<Scope>()

        context.registerFactory('serviceA', (serviceB: ServiceB) => new ServiceA(serviceB), ['serviceB'])
        context.registerFactory('serviceB', (serviceA: ServiceA) => new ServiceB(serviceA), ['serviceA'])

        const serviceA = context.resolve('serviceA')
        const serviceB = context.resolve('serviceB')

        expect(serviceA).toBeInstanceOf(ServiceA)
        expect(serviceB).toBeInstanceOf(ServiceB)
        expect(serviceA.getName()).toBe('ServiceA')
        expect(serviceB.getName()).toBe('ServiceB')
        expect(serviceA.serviceB).not.toBe(serviceB)
        expect(serviceB.serviceA).not.toBe(serviceA)
        expect(serviceA.getOtherName()).toBe('ServiceB')
        expect(serviceB.getOtherName()).toBe('ServiceA')
    })

    it('should handle circular dependencies with registerFactory creating POJOs', () => {
        type ServiceA = {
            name: string
            serviceB: ServiceB
            greet: () => string
        }

        type ServiceB = {
            name: string
            serviceA: ServiceA
            greet: () => string
        }

        type Scope = {
            serviceA: ServiceA
            serviceB: ServiceB
        }

        const context = new Context<Scope>()

        context.registerFactory(
            'serviceA',
            (serviceB: ServiceB): ServiceA => ({
                name: 'ServiceA',
                serviceB,
                greet: () => `Hello from ${serviceB.name}`,
            }),
            ['serviceB'],
        )

        context.registerFactory(
            'serviceB',
            (serviceA: ServiceA): ServiceB => ({
                name: 'ServiceB',
                serviceA,
                greet: () => `Hello from ${serviceA.name}`,
            }),
            ['serviceA'],
        )

        const serviceA = context.resolve('serviceA')
        const serviceB = context.resolve('serviceB')

        expect(serviceA.name).toBe('ServiceA')
        expect(serviceB.name).toBe('ServiceB')
        expect(serviceA.serviceB).not.toBe(serviceB)
        expect(serviceB.serviceA).not.toBe(serviceA)
        expect(serviceA.greet()).toBe('Hello from ServiceB')
        expect(serviceB.greet()).toBe('Hello from ServiceA')
    })

    it('should handle circular dependencies with factory functions and singletons', () => {
        type ServiceA = { name: string; serviceB: ServiceB; counter: number }
        type ServiceB = { name: string; serviceA: ServiceA; counter: number }

        type Scope = {
            serviceA: ServiceA
            serviceB: ServiceB
        }

        let serviceACreations = 0
        let serviceBCreations = 0

        const context = new Context<Scope>()

        context.registerFactory(
            'serviceA',
            (serviceB: ServiceB): ServiceA => {
                serviceACreations++
                return {
                    name: 'ServiceA',
                    serviceB,
                    counter: serviceACreations,
                }
            },
            ['serviceB'],
            { singleton: true },
        )

        context.registerFactory(
            'serviceB',
            (serviceA: ServiceA): ServiceB => {
                serviceBCreations++
                return {
                    name: 'ServiceB',
                    serviceA,
                    counter: serviceBCreations,
                }
            },
            ['serviceA'],
            { singleton: true },
        )

        const serviceA1 = context.resolve('serviceA')
        const serviceB1 = context.resolve('serviceB')
        const serviceA2 = context.resolve('serviceA')
        const serviceB2 = context.resolve('serviceB')

        // Test that singletons work with circular dependencies
        expect(serviceA1).toBe(serviceA2)
        expect(serviceB1).toBe(serviceB2)
        expect(serviceA1.serviceB).toBe(serviceB1)
        expect(serviceB1.serviceA).toBe(serviceA1)

        // Test that factories were only called once each
        expect(serviceACreations).toBe(1)
        expect(serviceBCreations).toBe(1)
        expect(serviceA1.counter).toBe(1)
        expect(serviceB1.counter).toBe(1)
    })

    it('should demonstrate that circular dependencies work with registerAsyncFactory in a realistic scenario', async () => {
        // This test shows how to handle circular async dependencies by deferring resolution
        type UserService = {
            name: string
            getUser: (id: string) => Promise<{ id: string; orders: string[] }>
        }

        type OrderService = {
            name: string
            getOrdersForUser: (userId: string) => Promise<string[]>
        }

        type Scope = {
            userService: Promise<UserService>
            orderService: Promise<OrderService>
        }

        const context = new Context<Scope>()

        context.registerAsyncFactory(
            'userService',
            async (): Promise<UserService> => {
                await new Promise((resolve) => setTimeout(resolve, 5))
                return {
                    name: 'UserService',
                    getUser: async (id: string) => {
                        // Resolve orderService when needed (lazy resolution)
                        const orderService = await context.resolve('orderService')
                        const orders = await orderService.getOrdersForUser(id)
                        return { id, orders }
                    },
                }
            },
            [],
            { singleton: true },
        )

        context.registerAsyncFactory(
            'orderService',
            async (): Promise<OrderService> => {
                await new Promise((resolve) => setTimeout(resolve, 5))
                return {
                    name: 'OrderService',
                    getOrdersForUser: async (userId: string) => {
                        // This could potentially use userService in the future
                        return [`Order1-${userId}`, `Order2-${userId}`]
                    },
                }
            },
            [],
            { singleton: true },
        )

        const userService = await context.resolve('userService')
        const orderService = await context.resolve('orderService')

        expect(userService.name).toBe('UserService')
        expect(orderService.name).toBe('OrderService')

        const user = await userService.getUser('user123')
        expect(user.id).toBe('user123')
        expect(user.orders).toEqual(['Order1-user123', 'Order2-user123'])

        const orders = await orderService.getOrdersForUser('user456')
        expect(orders).toEqual(['Order1-user456', 'Order2-user456'])
    })
})
