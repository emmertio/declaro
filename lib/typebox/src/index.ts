import { FormatRegistry } from '@sinclair/typebox'
import { HtmlValidate } from 'html-validate'

export * from '@sinclair/typebox'

FormatRegistry.Set('html', (value) => {
    const htmlvalidate = new HtmlValidate()

    const report = htmlvalidate.validateSourceSync({
        data: value,
        filename: 'input.html',
        line: 1,
        column: 1,
        offset: 0,
    })

    return report.valid
})

// Export TypeBox utilities here
export { FormatRegistry }
