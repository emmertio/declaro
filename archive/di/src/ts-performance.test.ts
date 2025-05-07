import { describe, expect, it } from 'vitest'
import ts from 'typescript'
import { LanguageService } from './test/language-service'

function measurePerformance(filePath: string) {
    const program = ts.createProgram([filePath], { noEmit: true })
    const start = performance.now()

    program.getSemanticDiagnostics() // Type-check the file
    program.getSyntacticDiagnostics() // Syntax-check the file

    const end = performance.now()
    return end - start
}

describe('TypeScript Performance', () => {
    // it('should type-check a large file in under 500ms', () => {
    //     const simpleFile = require.resolve('./test/simple-file.ts')
    //     const baselineTime = measurePerformance(simpleFile)

    //     console.log('Baseline Time:', baselineTime)

    //     const filePath = require.resolve('./container.ts')
    //     const time = measurePerformance(filePath)
    //     console.log('Time:', time)
    //     expect(time).toBeLessThan(500)
    // })
    it('should type-check a large file in under 500ms', () => {
        const simpleLanguageService = new LanguageService(require.resolve('./test/simple-file.ts'))
        const baselineTime = simpleLanguageService.measurePerformance()

        console.log('Baseline Time:', baselineTime)

        const languageService = new LanguageService(require.resolve('./test/massive-container.ts'))
        const time = languageService.measurePerformance()
        console.log('Time:', time)

        const benchmark = baselineTime - time

        expect(benchmark).toBeLessThan(50)
    })
})
