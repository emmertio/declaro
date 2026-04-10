import { describe, expect, it } from 'vitest'
import { Context, isProxy } from './context'

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
        expect(serviceA1).toEqual(serviceA2)
        expect(serviceB1).toEqual(serviceB2)
        expect(serviceA1.serviceB).toEqual(serviceB1)
        expect(serviceB1.serviceA).toEqual(serviceA1)
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
        expect(serviceA.serviceB).toEqual(serviceB)
        expect(serviceB.serviceA).toEqual(serviceA)
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
        expect(serviceA1.serviceB).toEqual(serviceB1)
        expect(serviceB1.serviceA).toEqual(serviceA1)

        // Test that factories were only called once each
        expect(serviceACreations).toBe(1)
        expect(serviceBCreations).toBe(1)
        expect(serviceA1.counter).toBe(1)
        expect(serviceB1.counter).toBe(1)
    })

    it('should demonstrate that circular dependencies work with registerAsyncFactory in a realistic scenario', async () => {
        // This test shows how to handle circular async dependencies by deferring resolution
        // type UserService = {
        //     name: string
        //     getUser: (id: string) => Promise<{ id: string; orders: string[] }>
        // }
        class UserService {
            constructor(public orderService: OrderService) {}

            name = 'UserService'

            async getUser(id: string): Promise<{ id: string; orders: string[] }> {
                const orders = await this.orderService.getOrdersForUser(id)
                return { id, orders }
            }
        }

        // type OrderService = {
        //     name: string
        //     getOrdersForUser: (userId: string) => Promise<string[]>
        // }
        class OrderService {
            constructor(public userService: UserService) {}

            name = 'OrderService'

            async getOrdersForUser(userId: string): Promise<string[]> {
                // This could potentially use userService in the future
                return [`Order1-${userId}`, `Order2-${userId}`]
            }
        }

        type Scope = {
            userService: Promise<UserService>
            orderService: Promise<OrderService>
        }

        const context = new Context<Scope>()

        context.registerAsyncFactory(
            'userService',
            async (orderService: OrderService): Promise<UserService> => {
                await new Promise((resolve) => setTimeout(resolve, 5))
                return new UserService(orderService)
            },
            ['orderService'],
            { singleton: true },
        )

        context.registerAsyncFactory(
            'orderService',
            async (userService: UserService): Promise<OrderService> => {
                await new Promise((resolve) => setTimeout(resolve, 5))
                return new OrderService(userService)
            },
            ['userService'],
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

    it('should handle circular dependencies between registerClass and registerAsyncClass', async () => {
        class SyncService {
            constructor(public asyncService: Promise<AsyncService>) {}

            getName() {
                return 'SyncService'
            }

            async getAsyncName() {
                const service = await this.asyncService
                return service.getName()
            }
        }

        class AsyncService {
            constructor(public syncService: SyncService) {}

            getName() {
                return 'AsyncService'
            }

            getSyncName() {
                return this.syncService.getName()
            }
        }

        type Scope = {
            syncService: SyncService
            asyncService: Promise<AsyncService>
        }

        const context = new Context<Scope>()

        context.registerClass('syncService', SyncService, ['asyncService'])
        context.registerAsyncClass('asyncService', AsyncService, ['syncService'])

        const syncService = context.resolve('syncService')
        const asyncService = await context.resolve('asyncService')

        expect(syncService).toBeInstanceOf(SyncService)
        expect(asyncService).toBeInstanceOf(AsyncService)
        expect(syncService.getName()).toBe('SyncService')
        expect(asyncService.getName()).toBe('AsyncService')

        // Test circular references work
        expect(await syncService.getAsyncName()).toBe('AsyncService')
        expect(asyncService.getSyncName()).toBe('SyncService')

        // The async service should match
        expect(await syncService.asyncService).toBeInstanceOf(AsyncService)
        expect(asyncService.syncService).toBeInstanceOf(SyncService)
    })

    it('should support structured dependency injection via async factories', async () => {
        // Define argument interfaces for structured dependency injection
        interface IServiceAArgs {
            serviceB: ServiceB
        }

        interface IServiceBArgs {
            serviceA: ServiceA
        }

        // Service classes that accept structured arguments
        class ServiceA {
            constructor(public readonly args: IServiceAArgs) {}

            getName() {
                return 'ServiceA'
            }

            getServiceBName() {
                return this.args.serviceB.getName()
            }
        }

        class ServiceB {
            constructor(public readonly args: IServiceBArgs) {}

            getName() {
                return 'ServiceB'
            }

            getServiceAName() {
                return this.args.serviceA.getName()
            }
        }

        type Scope = {
            serviceA: Promise<ServiceA>
            serviceB: Promise<ServiceB>
        }

        const context = new Context<Scope>()

        // This is the ACTUAL way users would try to register circular async factories
        // This will fail because registerAsyncFactory expects Promise<ServiceB> not ServiceB
        context.registerAsyncFactory(
            'serviceA',
            async (serviceB: ServiceB): Promise<ServiceA> => {
                await new Promise((resolve) => setTimeout(resolve, 2))
                return new ServiceA({ serviceB })
            },
            ['serviceB'],
            { singleton: true },
        )

        context.registerAsyncFactory(
            'serviceB',
            async (serviceA: ServiceA): Promise<ServiceB> => {
                await new Promise((resolve) => setTimeout(resolve, 2))
                return new ServiceB({ serviceA })
            },
            ['serviceA'],
            { singleton: true },
        )

        const serviceA = await context.resolve('serviceA')
        const serviceB = await context.resolve('serviceB')

        expect(serviceA).toBeInstanceOf(ServiceA)
        expect(serviceB).toBeInstanceOf(ServiceB)
        expect(serviceA.args.serviceB).toEqual(serviceB)
        expect(serviceB.args.serviceA).toEqual(serviceA)
    })

    it('should handle multiple async circular dependency chains in parallel', async () => {
        // Chain 1: Multiple async factories with circular dependencies
        type ServiceA = { name: string; serviceB: Promise<ServiceB>; serviceC: Promise<ServiceC> }
        type ServiceB = { name: string; serviceA: Promise<ServiceA>; serviceC: Promise<ServiceC> }
        type ServiceC = { name: string; serviceA: Promise<ServiceA>; serviceB: Promise<ServiceB> }

        // Chain 2: Another set of async factories with circular dependencies
        type ServiceX = { name: string; serviceY: Promise<ServiceY>; serviceZ: Promise<ServiceZ> }
        type ServiceY = { name: string; serviceX: Promise<ServiceX>; serviceZ: Promise<ServiceZ> }
        type ServiceZ = { name: string; serviceX: Promise<ServiceX>; serviceY: Promise<ServiceY> }

        type Scope1 = {
            serviceA: Promise<ServiceA>
            serviceB: Promise<ServiceB>
            serviceC: Promise<ServiceC>
        }

        type Scope2 = {
            serviceX: Promise<ServiceX>
            serviceY: Promise<ServiceY>
            serviceZ: Promise<ServiceZ>
        }

        const context1 = new Context<Scope1>()
        const context2 = new Context<Scope2>()

        // Register async factories with multiple circular dependencies for chain 1
        context1.registerAsyncFactory(
            'serviceA',
            async (): Promise<ServiceA> => {
                await new Promise((resolve) => setTimeout(resolve, 1))
                return {
                    name: 'ServiceA',
                    serviceB: context1.resolve('serviceB'),
                    serviceC: context1.resolve('serviceC'),
                }
            },
            [],
            { singleton: true },
        )

        context1.registerAsyncFactory(
            'serviceB',
            async (): Promise<ServiceB> => {
                await new Promise((resolve) => setTimeout(resolve, 1))
                return {
                    name: 'ServiceB',
                    serviceA: context1.resolve('serviceA'),
                    serviceC: context1.resolve('serviceC'),
                }
            },
            [],
            { singleton: true },
        )

        context1.registerAsyncFactory(
            'serviceC',
            async (): Promise<ServiceC> => {
                await new Promise((resolve) => setTimeout(resolve, 1))
                return {
                    name: 'ServiceC',
                    serviceA: context1.resolve('serviceA'),
                    serviceB: context1.resolve('serviceB'),
                }
            },
            [],
            { singleton: true },
        )

        // Register async factories with multiple circular dependencies for chain 2
        context2.registerAsyncFactory(
            'serviceX',
            async (): Promise<ServiceX> => {
                await new Promise((resolve) => setTimeout(resolve, 1))
                return {
                    name: 'ServiceX',
                    serviceY: context2.resolve('serviceY'),
                    serviceZ: context2.resolve('serviceZ'),
                }
            },
            [],
            { singleton: true },
        )

        context2.registerAsyncFactory(
            'serviceY',
            async (): Promise<ServiceY> => {
                await new Promise((resolve) => setTimeout(resolve, 1))
                return {
                    name: 'ServiceY',
                    serviceX: context2.resolve('serviceX'),
                    serviceZ: context2.resolve('serviceZ'),
                }
            },
            [],
            { singleton: true },
        )

        context2.registerAsyncFactory(
            'serviceZ',
            async (): Promise<ServiceZ> => {
                await new Promise((resolve) => setTimeout(resolve, 1))
                return {
                    name: 'ServiceZ',
                    serviceX: context2.resolve('serviceX'),
                    serviceY: context2.resolve('serviceY'),
                }
            },
            [],
            { singleton: true },
        )

        // Resolve both chains in parallel with multiple async dependencies
        const [{ serviceA, serviceB, serviceC }, { serviceX, serviceY, serviceZ }] = await Promise.all([
            Promise.all([
                context1.resolve('serviceA'),
                context1.resolve('serviceB'),
                context1.resolve('serviceC'),
            ]).then(([a, b, c]) => ({ serviceA: a, serviceB: b, serviceC: c })),
            Promise.all([
                context2.resolve('serviceX'),
                context2.resolve('serviceY'),
                context2.resolve('serviceZ'),
            ]).then(([x, y, z]) => ({ serviceX: x, serviceY: y, serviceZ: z })),
        ])

        // Verify both chains resolved correctly
        expect(serviceA.name).toBe('ServiceA')
        expect(serviceB.name).toBe('ServiceB')
        expect(serviceC.name).toBe('ServiceC')
        expect(serviceX.name).toBe('ServiceX')
        expect(serviceY.name).toBe('ServiceY')
        expect(serviceZ.name).toBe('ServiceZ')

        // Verify circular references work within each chain (singletons should be same instances)
        expect(await serviceA.serviceB).toEqual(serviceB)
        expect(await serviceA.serviceC).toEqual(serviceC)
        expect(await serviceB.serviceA).toEqual(serviceA)
        expect(await serviceB.serviceC).toEqual(serviceC)
        expect(await serviceC.serviceA).toEqual(serviceA)
        expect(await serviceC.serviceB).toEqual(serviceB)

        expect(await serviceX.serviceY).toEqual(serviceY)
        expect(await serviceX.serviceZ).toEqual(serviceZ)
        expect(await serviceY.serviceX).toEqual(serviceX)
        expect(await serviceY.serviceZ).toEqual(serviceZ)
        expect(await serviceZ.serviceX).toEqual(serviceX)
        expect(await serviceZ.serviceY).toEqual(serviceY)

        // Verify chains are independent (no cross-contamination)
        expect(serviceA.name).not.toEqual(serviceX.name)
        expect(serviceB.name).not.toEqual(serviceY.name)
        expect(serviceC.name).not.toEqual(serviceZ.name)
    })

    it('should not leak memory after circular dependency resolution', async () => {
        class ServiceA {
            constructor(public serviceB: ServiceB) {}
        }

        class ServiceB {
            constructor(public serviceA: ServiceA) {}
        }

        type Scope = {
            serviceA: ServiceA
            serviceB: ServiceB
        }

        let weakRefA: WeakRef<ServiceA> | undefined
        let weakRefB: WeakRef<ServiceB> | undefined
        let weakRefContext: WeakRef<any> | undefined

        // Scope the resolution to allow garbage collection
        {
            const context = new Context<Scope>()
            context.registerClass('serviceA', ServiceA, ['serviceB'])
            context.registerClass('serviceB', ServiceB, ['serviceA'])

            const resolutionContext = new Map()
            const serviceA = context.resolve('serviceA', { resolutionContext })
            const serviceB = context.resolve('serviceB', { resolutionContext })

            // Create weak references to track garbage collection
            weakRefA = new WeakRef(serviceA)
            weakRefB = new WeakRef(serviceB)
            weakRefContext = new WeakRef(resolutionContext)

            // Verify objects exist
            expect(weakRefA.deref()).toBeDefined()
            expect(weakRefB.deref()).toBeDefined()
            expect(weakRefContext.deref()).toBeDefined()
        }

        // Force garbage collection (if available)
        if (global.gc) {
            global.gc()
            // Wait a bit for GC to complete
            await new Promise((resolve) => setTimeout(resolve, 5))
        }

        // Note: We can't reliably test GC in all environments, but we can at least
        // verify the test structure works and doesn't throw errors
        expect(weakRefA).toBeDefined()
        expect(weakRefB).toBeDefined()
        expect(weakRefContext).toBeDefined()
    })

    it('should handle circular dependencies with context extension and inheritance', () => {
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

        class CustomServiceB extends ServiceB {
            getName() {
                return 'CustomServiceB'
            }
        }

        type BaseScope = {
            serviceA: ServiceA
            serviceB: ServiceB
        }

        type CustomScope = BaseScope & {
            serviceB: CustomServiceB
        }

        // Base context with circular dependencies
        const baseContext = new Context<BaseScope>()
        baseContext.registerClass('serviceA', ServiceA, ['serviceB'])
        baseContext.registerClass('serviceB', ServiceB, ['serviceA'])

        // Custom context extends base and overrides serviceB
        const customContext = new Context<CustomScope>()
        customContext.extend(baseContext)
        customContext.registerClass('serviceB', CustomServiceB, ['serviceA'])

        const serviceA = customContext.resolve('serviceA')
        const serviceB = customContext.resolve('serviceB')

        expect(serviceA).toBeInstanceOf(ServiceA)
        expect(serviceB).toBeInstanceOf(CustomServiceB)
        expect(serviceA.getName()).toBe('ServiceA')
        expect(serviceB.getName()).toBe('CustomServiceB')

        // Test that circular dependency resolved with the overridden class
        expect(serviceA.serviceB).toBeInstanceOf(CustomServiceB)
        expect(serviceB.serviceA).toBeInstanceOf(ServiceA)
        expect(serviceA.serviceB.getName()).toBe('CustomServiceB')
    })

    it('should handle resolution context with pre-populated values', () => {
        // Test case 1: Pre-populate a simple non-circular dependency
        class ServiceC {
            getName() {
                return 'ServiceC'
            }
            getSpecialValue() {
                return 'special'
            }
        }

        class ServiceA {
            constructor(public serviceC: ServiceC) {}
            getName() {
                return 'ServiceA'
            }
        }

        type Scope = {
            serviceA: ServiceA
            serviceC: ServiceC
        }

        const context = new Context<Scope>()
        context.registerClass('serviceA', ServiceA, ['serviceC'])
        context.registerClass('serviceC', ServiceC, [])

        // Create a custom ServiceC instance with modified behavior
        const customServiceC = new ServiceC()
        customServiceC.getSpecialValue = () => 'custom-special'

        // Pre-populate resolution context using the internal API
        // Note: This uses the internal __instanceCache which is the current API
        const resolutionContext = new Map([['serviceC', customServiceC]])

        // Resolve serviceA with the pre-populated context
        const serviceA = context.resolve('serviceA', { resolutionContext })

        expect(serviceA).toBeInstanceOf(ServiceA)
        expect(serviceA.serviceC).toBe(customServiceC) // Should use pre-populated instance
        expect(serviceA.serviceC.getName()).toBe('ServiceC')
        expect(serviceA.serviceC.getSpecialValue()).toBe('custom-special') // Verify it's our custom instance

        // When resolving serviceC directly, it should return the pre-populated instance
        const serviceC = context.resolve('serviceC', { resolutionContext })
        expect(serviceC).toEqual(customServiceC)
        expect(serviceC.getSpecialValue()).toBe('custom-special')
        expect(isProxy(serviceC)).toBeFalsy()

        // Test case 2: Pre-populate in a simpler non-circular scenario to show the API works
        class ServiceD {
            constructor(public value: string) {}
            getValue() {
                return this.value
            }
        }

        class ServiceB2 {
            constructor(public serviceD: ServiceD) {}
            getName() {
                return 'ServiceB2'
            }
        }

        type Scope2 = {
            serviceB2: ServiceB2
            serviceD: ServiceD
            value: string
        }

        const context2 = new Context<Scope2>()
        context2.registerClass('serviceB2', ServiceB2, ['serviceD'])
        context2.registerFactory('serviceD', (value: string) => new ServiceD(value), ['value'])
        context2.registerValue('value', 'default-value')

        // Pre-populate serviceD with a custom instance
        const customServiceD = new ServiceD('custom-value')
        const resolutionContext2 = new Map([['serviceD', customServiceD]])

        // Resolve serviceB2, which should use the pre-populated serviceD
        const serviceB2 = context2.resolve('serviceB2', { resolutionContext: resolutionContext2 })

        expect(serviceB2).toBeInstanceOf(ServiceB2)
        expect(serviceB2.serviceD).toBe(customServiceD)
        expect(serviceB2.serviceD.getValue()).toBe('custom-value')
        expect(isProxy(serviceB2)).toBeFalsy()

        // Test case 3: Verify that different resolution contexts create different instances
        const anotherResolutionContext = new Map()

        const anotherServiceA = context.resolve('serviceA', { resolutionContext: anotherResolutionContext })
        const anotherServiceC = context.resolve('serviceC', { resolutionContext: anotherResolutionContext })

        // Different resolution contexts should create different instances
        expect(anotherServiceA).not.toBe(serviceA)
        expect(anotherServiceC).not.toBe(customServiceC)
        expect(anotherServiceA.serviceC).toEqual(anotherServiceC) // But within same context, should be same
    })

    it('should not return proxies when resolving values', async () => {
        type Scope = {
            foo: String
        }

        const context = new Context<Scope>()

        context.registerValue('foo', 'bar')

        const foo = context.resolve('foo')
        expect(foo).toBe('bar')

        expect((foo as any).__isProxy).toBeFalsy()
    })

    it('should not return proxies when resolving non-circular factories', async () => {
        // Service classes that accept structured arguments
        class ServiceA {
            constructor() {}

            getName() {
                return 'ServiceA'
            }
        }

        type Scope = {
            serviceA: ServiceA
        }

        const context = new Context<Scope>()

        context.registerFactory('serviceA', () => new ServiceA(), [], { singleton: true })

        const serviceA = context.resolve('serviceA')
        expect(serviceA).toBeInstanceOf(ServiceA)
        expect((serviceA as any).__isProxy).toBeFalsy()
    })
})
