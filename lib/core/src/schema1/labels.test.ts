import { describe, expect, it } from 'vitest'
import { getEntityLabels } from './labels'

describe('Entity Labels', () => {
    it('Should be able to define labels for entities', () => {
        const labels = getEntityLabels('User')

        expect(labels.singularLabel).toBe('User')
        expect(labels.pluralLabel).toBe('Users')
        expect(labels.singularParameter).toBe('user')
        expect(labels.pluralParameter).toBe('users')
        expect(labels.singularSlug).toBe('user')
        expect(labels.pluralSlug).toBe('users')
        expect(labels.singularEntityName).toBe('User')
        expect(labels.pluralEntityName).toBe('Users')
        expect(labels.singularTableName).toBe('user')
        expect(labels.pluralTableName).toBe('users')
    })

    it('Should handle different types of entity names', () => {
        const twoWords = getEntityLabels('SomeEntity')

        expect(twoWords.singularLabel).toBe('Some Entity')
        expect(twoWords.pluralLabel).toBe('Some Entities')
        expect(twoWords.singularParameter).toBe('someEntity')
        expect(twoWords.pluralParameter).toBe('someEntities')
        expect(twoWords.singularSlug).toBe('some-entity')
        expect(twoWords.pluralSlug).toBe('some-entities')
        expect(twoWords.singularEntityName).toBe('SomeEntity')
        expect(twoWords.pluralEntityName).toBe('SomeEntities')
        expect(twoWords.singularTableName).toBe('some-entity')
        expect(twoWords.pluralTableName).toBe('some-entities')

        const threeWords = getEntityLabels('SomeOtherEntity')

        expect(threeWords.singularLabel).toBe('Some Other Entity')
        expect(threeWords.pluralLabel).toBe('Some Other Entities')
        expect(threeWords.singularParameter).toBe('someOtherEntity')
        expect(threeWords.pluralParameter).toBe('someOtherEntities')
        expect(threeWords.singularSlug).toBe('some-other-entity')
        expect(threeWords.pluralSlug).toBe('some-other-entities')
        expect(threeWords.singularEntityName).toBe('SomeOtherEntity')
        expect(threeWords.pluralEntityName).toBe('SomeOtherEntities')
        expect(threeWords.singularTableName).toBe('some-other-entity')
        expect(threeWords.pluralTableName).toBe('some-other-entities')

        const sentence = getEntityLabels('Some other entity')

        expect(sentence.singularLabel).toBe('Some Other Entity')
        expect(sentence.pluralLabel).toBe('Some Other Entities')
        expect(sentence.singularParameter).toBe('someOtherEntity')
        expect(sentence.pluralParameter).toBe('someOtherEntities')
        expect(sentence.singularSlug).toBe('some-other-entity')
        expect(sentence.pluralSlug).toBe('some-other-entities')
        expect(sentence.singularEntityName).toBe('SomeOtherEntity')
        expect(sentence.pluralEntityName).toBe('SomeOtherEntities')
        expect(sentence.singularTableName).toBe('some-other-entity')
        expect(sentence.pluralTableName).toBe('some-other-entities')
    })
})
