import { Container, defineExtension } from '../container'

export type DeepNestedObject = {
    level1: {
        level2: {
            level3: {
                level4: {
                    level5: {
                        level6: {
                            level7: {
                                level8: {
                                    level9: {
                                        level10: {
                                            name: string
                                            value: number
                                            nestedArray: Array<{
                                                id: number
                                                data: {
                                                    info: string
                                                    details: {
                                                        description: string
                                                        metadata: {
                                                            created: Date
                                                            updated: Date
                                                            tags: string[]
                                                            flags: {
                                                                isActive: boolean
                                                                isDeleted: boolean
                                                            }
                                                        }
                                                    }
                                                }
                                            }>
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }
    }
}

export const complexObject: DeepNestedObject = {
    level1: {
        level2: {
            level3: {
                level4: {
                    level5: {
                        level6: {
                            level7: {
                                level8: {
                                    level9: {
                                        level10: {
                                            name: 'Deeply Nested Object',
                                            value: 42,
                                            nestedArray: [
                                                {
                                                    id: 1,
                                                    data: {
                                                        info: 'Sample Info',
                                                        details: {
                                                            description: 'Sample Description',
                                                            metadata: {
                                                                created: new Date(),
                                                                updated: new Date(),
                                                                tags: ['sample', 'test'],
                                                                flags: {
                                                                    isActive: true,
                                                                    isDeleted: false,
                                                                },
                                                            },
                                                        },
                                                    },
                                                },
                                            ],
                                        },
                                    },
                                },
                            },
                        },
                    },
                },
            },
        },
    },
}

export class BigClass {
    constructor(public readonly complexObject: DeepNestedObject) {}
}

export const massiveModule = defineExtension((container) => {
    return (
        container
            .provideValue('complexObject', complexObject)
            // .provideValue(
            //     'deeplyNestedObject',
            //     complexObject.level1.level2.level3.level4.level5.level6.level7.level8.level9.level10,
            // )
            .provideAsyncClass('bigAsyncClass', BigClass, ['complexObject'])
            .provideAsyncFactory('deeplyNestedObjectFactory', async (container) => {
                return container.get('deeplyNestedObject')
            })
            .provideFactory('deeplyNestedObjectFactorySync', (container) => {
                return container.get('deeplyNestedObject')
            })
            .provideClass('bigClass', BigClass, ['complexObject'])
            .provideValue('value1', complexObject)
            .provideValue('value2', complexObject)
            .provideValue('value3', complexObject)
            .provideValue('value4', complexObject)
            .provideValue('value5', complexObject)
            .provideValue('value6', complexObject)
            .provideValue('value7', complexObject)
            .provideValue('value8', complexObject)
            .provideValue('value9', complexObject)
            .provideValue('value10', complexObject)
            .provideValue('value11', complexObject)
            .provideValue('value12', complexObject)
            .provideValue('value13', complexObject)
            .provideValue('value14', complexObject)
            .provideValue('value15', complexObject)
            .provideValue('value16', complexObject)
            .provideValue('value17', complexObject)
            .provideValue('value18', complexObject)
            .provideValue('value19', complexObject)
            .provideValue('value20', complexObject)
            .provideValue('value21', complexObject)
            .provideValue('value22', complexObject)
            .provideValue('value23', complexObject)
            .provideValue('value24', complexObject)
            .provideValue('value25', complexObject)
            .provideValue('value26', complexObject)
            .provideValue('value27', complexObject)
            .provideValue('value28', complexObject)
            .provideValue('value29', complexObject)
            .provideValue('value30', complexObject)
            .provideValue('value31', complexObject)
            .provideValue('value32', complexObject)
            .provideValue('value33', complexObject)
            .provideValue('value34', complexObject)
            .provideValue('value35', complexObject)
            .provideValue('value36', complexObject)
            .provideValue('value37', complexObject)
            .provideValue('value38', complexObject)
            .provideValue('value39', complexObject)
            .provideValue('value40', complexObject)
            .provideValue('value41', complexObject)
            .provideValue('value42', complexObject)
            .provideValue('value43', complexObject)
            .provideValue('value44', complexObject)
            .provideValue('value45', complexObject)
            .provideValue('value46', complexObject)
            .provideValue('value47', complexObject)
            .provideValue('value48', complexObject)
            .provideValue('value49', complexObject)
            .provideValue('value50', complexObject)
            .provideValue('value51', complexObject)
            .provideValue('value52', complexObject)
            .provideValue('value53', complexObject)
            .provideValue('value54', complexObject)
            .provideValue('value55', complexObject)
            .provideValue('value56', complexObject)
            .provideValue('value57', complexObject)
            .provideValue('value58', complexObject)
            .provideValue('value59', complexObject)
            .provideValue('value60', complexObject)
            .provideValue('value61', complexObject)
            .provideValue('value62', complexObject)
            .provideValue('value63', complexObject)
            .provideValue('value64', complexObject)
            .provideValue('value65', complexObject)
            .provideValue('value66', complexObject)
            .provideValue('value67', complexObject)
            .provideValue('value68', complexObject)
            .provideValue('value69', complexObject)
            .provideValue('value70', complexObject)
            .provideValue('value71', complexObject)
            .provideValue('value72', complexObject)
            .provideValue('value73', complexObject)
            .provideValue('value74', complexObject)
            .provideValue('value75', complexObject)
            .provideValue('value76', complexObject)
            .provideValue('value77', complexObject)
            .provideValue('value78', complexObject)
            .provideValue('value79', complexObject)
            .provideValue('value80', complexObject)
            .provideValue('value81', complexObject)
            .provideValue('value82', complexObject)
            .provideValue('value83', complexObject)
            .provideValue('value84', complexObject)
            .provideValue('value85', complexObject)
            .provideValue('value86', complexObject)
            .provideValue('value87', complexObject)
            .provideValue('value88', complexObject)
            .provideValue('value89', complexObject)
            .provideValue('value90', complexObject)
            .provideValue('value91', complexObject)
            .provideValue('value92', complexObject)
            .provideValue('value93', complexObject)
            .provideValue('value94', complexObject)
            .provideValue('value95', complexObject)
            .provideValue('value96', complexObject)
            .provideValue('value97', complexObject)
            .provideValue('value98', complexObject)
            .provideValue('value99', complexObject)
            .provideValue('value100', complexObject)
    )
})

export const container = new Container()
    .extend(massiveModule)
    .extend(massiveModule)
    .extend(massiveModule)
    .extend(massiveModule)
    .extend(massiveModule)
    .extend(massiveModule)
    .extend(massiveModule)
    .extend(massiveModule)
    .extend(massiveModule)
    .extend(massiveModule)
    .extend(massiveModule)
