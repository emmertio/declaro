import { BaseModel } from '../../db/models/BaseModel'
import { defineModel, RelationFormat } from '@declaro/core'
import { StringFormat } from '@declaro/core'

export const Contact = defineModel('Contact', {
    type: 'object',
    properties: {
        firstName: {
            type: 'string',
            title: 'First Name',
        },
        lastName: {
            type: 'string',
            title: 'Last Name',
        },
        email: {
            type: 'string',
            title: 'Email',
            format: StringFormat.Email,
        },
    },
})

// export const Person = defineModel('Person', {
//     type: 'object',
//     properties: {
//         name: {
//             type: 'string',
//             title: 'Name',
//         },
//         movies: {
//             $ref: 'Movie',
//             format: RelationFormat.OneToMany,
//             // mappedBy: 'director'
//         },
//     },
// })
