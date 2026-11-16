import type { ChurchToolsSong, ChurchToolsArrangement, ChurchToolsFile } from "./types"
import path from "path"

export interface ParsedArrangement {
    id: number
    name: string
    isDefault: boolean
    key: string | null
    tempo: number | null
    duration: number | null
    lyrics: string[]
    sections: { name: string; lines: string[] }[]
    chords?: string
    ccli?: string | null
    author?: string | null
    copyright?: string | null
    files: ChurchToolsFile[]
}

export class SongArrangementHandler {
    private downloadFile: (url: string) => Promise<Blob>

    constructor(downloadFile: (url: string) => Promise<Blob>) {
        this.downloadFile = downloadFile
    }

    async parseArrangement(arrangement: ChurchToolsArrangement, song: ChurchToolsSong): Promise<ParsedArrangement> {
        const sngContent = arrangement._sng_header ? arrangement._sng_header.join("\n") : ""
        const parsed = sngContent ? this.parseSongBeamer(sngContent) : this.createDefault(arrangement, song)

        return {
            id: arrangement.id,
            name: arrangement.name,
            isDefault: arrangement.isDefault,
            key: arrangement.key,
            tempo: arrangement.tempo,
            duration: arrangement.duration,
            lyrics: parsed.lyrics,
            sections: parsed.sections,
            chords: parsed.chords,
            ccli: song.ccli,
            author: song.author,
            copyright: arrangement.sourceReference,
            files: arrangement.files
        }
    }

    private parseSongBeamer(content: string): { lyrics: string[]; sections: { name: string; lines: string[] }[]; chords?: string } {
        const lines = content.split('\n').map(l => l.trim()).filter(l => l.length > 0)
        const lyrics: string[] = []
        const sections: { name: string; lines: string[] }[] = []
        let currentSection = { name: 'Verse 1', lines: [] as string[] }
        let inChords = false
        let chordsContent = ''

        for (const line of lines) {
            if (line.startsWith('{') && line.endsWith('}')) {
                // Section marker: {verse 1}, {chorus}, {bridge}, etc.
                if (currentSection.lines.length > 0) {
                    sections.push(currentSection)
                }
                const sectionName = line.slice(1, -1).trim()
                currentSection = { name: this.formatSectionName(sectionName), lines: [] }
            } else if (line.startsWith('[') && line.endsWith(']')) {
                // Chord line: [C] [F] [G] etc.
                inChords = true
                chordsContent += line + '\n'
            } else if (line.startsWith('{c:') || line.startsWith('{comment:')) {
                // Comment/chord directive
                inChords = true
                chordsContent += line + '\n'
            } else if (inChords && line && !line.startsWith('[') && !line.startsWith('{')) {
                // Lyric line after chords
                inChords = false
            } else if (line && !line.startsWith('{') && !line.startsWith('[')) {
                // Regular lyric line
                lyrics.push(line)
                currentSection.lines.push(line)
            }
        }

        if (currentSection.lines.length > 0) {
            sections.push(currentSection)
        }

        // If no sections found, create one
        if (sections.length === 0 && lyrics.length > 0) {
            sections.push({ name: 'Verse 1', lines: lyrics })
        }

        return { lyrics, sections, chords: chordsContent || undefined }
    }

    private formatSectionName(name: string): string {
        const lower = name.toLowerCase()
        if (lower.startsWith('verse')) return `Verse ${name.replace(/[^0-9]/g, '') || '1'}`
        if (lower.startsWith('chorus') || lower.startsWith('refrain')) return 'Chorus'
        if (lower.startsWith('bridge')) return 'Bridge'
        if (lower.startsWith('pre-chorus') || lower.startsWith('pre chorus')) return 'Pre-Chorus'
        if (lower.startsWith('intro')) return 'Intro'
        if (lower.startsWith('outro') || lower.startsWith('ending')) return 'Outro'
        if (lower.startsWith('tag')) return 'Tag'
        return name.charAt(0).toUpperCase() + name.slice(1)
    }

    private createDefault(arrangement: ChurchToolsArrangement, song: ChurchToolsSong): { lyrics: string[]; sections: { name: string; lines: string[] }[]; chords?: string } {
        return {
            lyrics: [arrangement.name || song.name],
            sections: [{ name: 'Main', lines: [arrangement.name || song.name] }],
            chords: undefined
        }
    }

    async downloadArrangementFiles(arrangement: ChurchToolsArrangement): Promise<{ path: string; type: string }[]> {
        const results: { path: string; type: string }[] = []
        
        for (const file of arrangement.files) {
            try {
                const blob = await this.downloadFile(file.fileUrl)
                const buffer = Buffer.from(await blob.arrayBuffer())
                const tempDir = await import('fs').then(fs => fs.promises.mkdtemp(require('os').tmpdir() + '/arrangement-'))
                const ext = path.extname(file.name) || '.bin'
                const filePath = path.join(tempDir, `${sanitizeFileName(file.name)}${ext}`)
                
                await import('fs').then(fs => fs.promises.writeFile(filePath, buffer))
                results.push({ path: filePath, type: ext.slice(1) })
            } catch (error) {
                console.error(`Failed to download arrangement file ${file.name}:`, error)
            }
        }
        return results
    }
}

function sanitizeFileName(name: string): string {
    return name.replace(/[^a-zA-Z0-9._-]/g, '_')
}