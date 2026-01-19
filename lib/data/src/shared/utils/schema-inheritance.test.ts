import { describe, expect, test } from 'bun:test'
import type { ChildSchema } from './schema-inheritance'
import type { IAnimalTraitSchema } from './test/animal-trait-schema'
import type { IElephantSchema } from './test/elephant-schema'
import type { IAnimalSchema } from './test/animal-schema'
import type { IElephantTraitSchema } from './test/elephant-trait-schema'
import type { InferDetail } from './schema-inference'

// Service Classes using ChildSchema

class AnimalService<TSchema extends ChildSchema<IAnimalSchema>> {
    getTraits(animal?: InferDetail<TSchema>): InferDetail<IAnimalTraitSchema>[] {
        return animal?.traits ?? []
    }
}

class ElephantService extends AnimalService<IElephantSchema> {
    getTrunkLength(elephant?: InferDetail<IElephantSchema>): number {
        return elephant?.trunkLength ?? 0
    }
}

class AnimalTraitService<TSchema extends ChildSchema<IAnimalTraitSchema>> {
    isTitleLong(trait?: InferDetail<TSchema>): boolean {
        return (trait?.title.length ?? 0) > 10
    }
}

class ElephantTraitService extends AnimalTraitService<IElephantTraitSchema> {
    isSharpTrait(trait?: InferDetail<IElephantTraitSchema>): boolean {
        return trait?.isSharp ?? false
    }
}

describe('Schema Inheritance Utils', () => {
    describe('AnimalService', () => {
        test('should get traits from animal detail', () => {
            const service = new AnimalService()
            const animal = {
                name: 'Lion',
                sound: 'Roar',
                traits: [
                    { title: 'Carnivore', description: 'Eats meat', animal: undefined },
                    { title: 'Predator', description: 'Hunts prey', animal: undefined },
                ],
            }

            const traits = service.getTraits(animal)

            expect(traits).toHaveLength(2)
            expect(traits[0].title).toBe('Carnivore')
            expect(traits[1].title).toBe('Predator')
        })

        test('should return empty array when animal has no traits', () => {
            const service = new AnimalService()
            const animal = {
                name: 'Lion',
                sound: 'Roar',
                traits: [],
            }

            const traits = service.getTraits(animal)

            expect(traits).toEqual([])
        })

        test('should return empty array when animal is undefined', () => {
            const service = new AnimalService()

            const traits = service.getTraits(undefined)

            expect(traits).toEqual([])
        })
    })

    describe('ElephantService', () => {
        test('should inherit getTraits from AnimalService', () => {
            const service = new ElephantService()
            const elephant = {
                name: 'Dumbo',
                sound: 'Trumpet',
                trunkLength: 150,
                traits: [
                    {
                        title: 'Long trunk',
                        description: 'Very long trunk',
                        isSharp: false,
                        length: 150,
                        animal: undefined,
                    },
                ],
            }

            const traits = service.getTraits(elephant)

            expect(traits).toHaveLength(1)
            expect(traits[0].title).toBe('Long trunk')
        })

        test('should get trunk length from elephant', () => {
            const service = new ElephantService()
            const elephant = {
                name: 'Dumbo',
                sound: 'Trumpet',
                trunkLength: 150,
                traits: [],
            }

            const trunkLength = service.getTrunkLength(elephant)

            expect(trunkLength).toBe(150)
        })

        test('should return 0 when elephant is undefined', () => {
            const service = new ElephantService()

            const trunkLength = service.getTrunkLength(undefined)

            expect(trunkLength).toBe(0)
        })

        test('should handle elephant with zero trunk length', () => {
            const service = new ElephantService()
            const elephant = {
                name: 'Baby Elephant',
                sound: 'Squeak',
                trunkLength: 0,
                traits: [],
            }

            const trunkLength = service.getTrunkLength(elephant)

            expect(trunkLength).toBe(0)
        })
    })

    describe('AnimalTraitService', () => {
        test('should identify long titles', () => {
            const service = new AnimalTraitService()
            const trait = {
                title: 'This is a very long title',
                description: 'Description',
                animal: undefined,
            }

            const isLong = service.isTitleLong(trait)

            expect(isLong).toBe(true)
        })

        test('should identify short titles', () => {
            const service = new AnimalTraitService()
            const trait = {
                title: 'Short',
                description: 'Description',
                animal: undefined,
            }

            const isLong = service.isTitleLong(trait)

            expect(isLong).toBe(false)
        })

        test('should handle exactly 10 character titles as short', () => {
            const service = new AnimalTraitService()
            const trait = {
                title: '1234567890',
                description: 'Description',
                animal: undefined,
            }

            const isLong = service.isTitleLong(trait)

            expect(isLong).toBe(false)
        })

        test('should return false when trait is undefined', () => {
            const service = new AnimalTraitService()

            const isLong = service.isTitleLong(undefined)

            expect(isLong).toBe(false)
        })
    })

    describe('ElephantTraitService', () => {
        test('should inherit isTitleLong from AnimalTraitService', () => {
            const service = new ElephantTraitService()
            const trait = {
                title: 'Very long elephant trait title',
                description: 'Description',
                isSharp: true,
                length: 50,
                animal: undefined,
            }

            const isLong = service.isTitleLong(trait)

            expect(isLong).toBe(true)
        })

        test('should identify sharp traits', () => {
            const service = new ElephantTraitService()
            const trait = {
                title: 'Sharp tusk',
                description: 'A sharp tusk',
                isSharp: true,
                length: 100,
                animal: undefined,
            }

            const isSharp = service.isSharpTrait(trait)

            expect(isSharp).toBe(true)
        })

        test('should identify non-sharp traits', () => {
            const service = new ElephantTraitService()
            const trait = {
                title: 'Soft ear',
                description: 'A soft ear',
                isSharp: false,
                length: 50,
                animal: undefined,
            }

            const isSharp = service.isSharpTrait(trait)

            expect(isSharp).toBe(false)
        })

        test('should return false when trait is undefined', () => {
            const service = new ElephantTraitService()

            const isSharp = service.isSharpTrait(undefined)

            expect(isSharp).toBe(false)
        })

        test('should handle both inherited and own methods', () => {
            const service = new ElephantTraitService()
            const trait = {
                title: 'Long and sharp tusk trait',
                description: 'Description',
                isSharp: true,
                length: 150,
                animal: undefined,
            }

            const isLong = service.isTitleLong(trait)
            const isSharp = service.isSharpTrait(trait)

            expect(isLong).toBe(true)
            expect(isSharp).toBe(true)
        })
    })

    describe('Schema Inheritance Type Safety', () => {
        test('should allow ElephantService to work with elephant-specific properties', () => {
            const service = new ElephantService()
            const elephant = {
                name: 'Babar',
                sound: 'Trumpet',
                trunkLength: 200,
                traits: [],
            }

            // Should compile and work with both animal and elephant properties
            const traits = service.getTraits(elephant)
            const trunkLength = service.getTrunkLength(elephant)

            expect(traits).toEqual([])
            expect(trunkLength).toBe(200)
        })

        test('should allow ElephantTraitService to work with elephant trait properties', () => {
            const service = new ElephantTraitService()
            const trait = {
                title: 'Trait',
                description: 'Desc',
                isSharp: true,
                length: 75,
                animal: undefined,
            }

            // Should compile and work with both animal trait and elephant trait properties
            const isLong = service.isTitleLong(trait)
            const isSharp = service.isSharpTrait(trait)

            expect(isLong).toBe(false)
            expect(isSharp).toBe(true)
        })
    })
})
