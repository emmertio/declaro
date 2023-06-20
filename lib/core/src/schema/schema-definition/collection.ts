import { Context } from '../../context'
import { capitalCase } from 'change-case'
import { EntityLabels, setLabels } from '../utils/labels'
import { AttributeFn } from './attribute'
import { PromiseType } from '../../typescript'

export type PropertyMap = {
    [key: string]: AttributeFn<any, any>
}

export type PropertyDetails<P extends PropertyMap> = {
    [K in keyof P]: PromiseType<ReturnType<P[K]>>
}

export async function loadExtensionProperties<
    E extends CollectionExtension<any>,
>(
    context: Context,
    extension: E,
): Promise<PropertyDetails<ExtensionProperties<E[]>>> {
    if ('load' in extension) {
        const collection = await extension.load(context)
        return loadProperties(
            context,
            collection.properties,
            collection.extends,
        )
    } else {
        return loadProperties(context, extension.properties, extension.extends)
    }
}

export async function loadProperties<
    P extends PropertyMap,
    E extends CollectionExtension<any>[] = [],
>(context: Context, map: P, extensions: E = [] as E) {
    const details: PropertyDetails<P & ExtensionProperties<E>> = {} as any

    console.log('EXTENSIONS', extensions)

    for (const extension of extensions) {
        const extProperties = await loadExtensionProperties(context, extension)
        // Object.assign(details, extProperties)
        console.log('EXT', extProperties)
    }

    // Load properties from local type map
    for (const key in map) {
        if (Object.prototype.hasOwnProperty.call(map, key)) {
            const fn = map[key]
            const attr = await fn({ name: key }, context)
            details[key] = attr
        }
    }

    return details
}

export type CollectionExtension<P extends PropertyMap> =
    | CollectionRef<P>
    | Collection<P>

export type ExtensionProperties<E extends CollectionExtension<any>[] = []> =
    E extends CollectionExtension<infer P>[] ? P : never

export type CollectionInput<
    P extends PropertyMap,
    E extends CollectionExtension<any>[] = [],
> = {
    title?: string
    description?: string
    labels?: EntityLabels
    graphql?: string
    typescript?: string
    properties: P
    extends?: E
}

export type Collection<P extends PropertyMap> = Required<
    CollectionInput<PropertyDetails<P>, CollectionExtension<any>[]>
> & {
    name: string
}

export type CollectionFactory<
    P extends PropertyMap,
    E extends CollectionExtension<any>[] = [],
> = (context: Context) => CollectionInput<P, E> | Promise<CollectionInput<P, E>>
export type CollectionDefinition<
    P extends PropertyMap,
    E extends CollectionExtension<any>[] = [],
> = CollectionFactory<P, E> | CollectionInput<P, E>

export type CollectionCreator<P extends PropertyMap> = (
    context: Context,
) => Promise<Collection<P>>
export type CollectionRef<
    P extends PropertyMap,
    E extends CollectionExtension<any>[] = [],
> = {
    name: string
    load: CollectionCreator<P>
}

export function defineCollection<
    P extends PropertyMap,
    E extends CollectionExtension<any>[] = [],
>(
    name: string,
    definition: CollectionDefinition<P, E>,
): CollectionRef<P & ExtensionProperties<E>> {
    return {
        name,
        load: async (
            context,
        ): Promise<Collection<P & ExtensionProperties<E>>> => {
            const input =
                typeof definition === 'function'
                    ? await definition(context)
                    : definition

            const labels = setLabels(name, input.labels)

            return {
                ...input,
                name,
                title: input.title ?? capitalCase(name),
                description: input.description ?? '',
                labels: labels,
                graphql: `${labels.singularEntityName}`,
                typescript: `${labels.singularEntityName}`,
                properties: await loadProperties(
                    context,
                    input.properties,
                    input.extends,
                ),
                extends: input.extends,
            }
        },
    }
}
