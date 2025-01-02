import ts from 'typescript'
import fs from 'fs'

export class LanguageService {
    private service: ts.LanguageService

    constructor(private filePath: string) {
        this.service = this.createService()
    }

    private createService(): ts.LanguageService {
        const scriptSnapshot = ts.ScriptSnapshot.fromString(fs.readFileSync(this.filePath, 'utf8'))
        const languageServiceHost: ts.LanguageServiceHost = {
            getScriptFileNames: () => [this.filePath],
            getScriptVersion: () => '0',
            getScriptSnapshot: (fileName) => (fileName === this.filePath ? scriptSnapshot : undefined),
            getCurrentDirectory: () => process.cwd(),
            getCompilationSettings: () => ({ noEmit: true }),
            getDefaultLibFileName: (options) => ts.getDefaultLibFilePath(options),
            fileExists: ts.sys.fileExists,
            readFile: ts.sys.readFile,
            readDirectory: ts.sys.readDirectory,
        }

        return ts.createLanguageService(languageServiceHost, ts.createDocumentRegistry())
    }

    public parseFile(): ts.Diagnostic[] {
        const syntacticDiagnostics = this.service.getSyntacticDiagnostics(this.filePath)
        const semanticDiagnostics = this.service.getSemanticDiagnostics(this.filePath)
        return [...syntacticDiagnostics, ...semanticDiagnostics]
    }

    public measurePerformance(): number {
        const start = performance.now()
        this.parseFile()
        const end = performance.now()
        return end - start
    }
}

export default LanguageService
