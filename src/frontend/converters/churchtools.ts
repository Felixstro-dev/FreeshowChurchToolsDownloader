import { get } from "svelte/store"
import { uid } from "uid"
import type { Item, Layout, Line, Slide, SlideData, Timeline } from "../../types/Show"
import { DEFAULT_ITEM_STYLE } from "../components/edit/scripts/itemHelpers"
import { checkName, getGlobalGroup, initializeMetadata, newSlide } from "../components/helpers/show"
import { translateText } from "../utils/language"
import { ShowObj } from "./../classes/Show"
import { activePopup, alertMessage, groups, shows, contentProviderData } from "./../stores"
import { createCategory, setTempShows } from "./importHelpers"
import { sendMain } from "../IPC/main"
import { Main } from "../../types/IPC/Main"
import { getDataFolderPath } from "../../electron/utils/files"
import type { ChurchToolsEventFull, ChurchToolsAgenda, ChurchToolsSong, ChurchToolsService, ChurchToolsServiceLead, ChurchToolsEventFile } from "../../electron/contentProviders/churchtools/types"

interface ChurchToolsImportData {
    event: ChurchToolsEventFull
    agenda: ChurchToolsAgenda
    songs: ChurchToolsSong[]
    services: ChurchToolsService[]
    serviceLeads: ChurchToolsServiceLead[]
    eventFiles: ChurchToolsEventFile[]
}

interface MatchedSong {
    churchToolsSong: ChurchToolsSong
    freeShowShowId?: string
    freeShowShowName?: string
    confidence: number
    matchType: "exact" | "title_artist" | "title_only" | "ccli" | "manual" | "none"
}

export function convertChurchTools(data: ChurchToolsImportData) {
    alertMessage.set("popup.importing")
    activePopup.set("alert")

    const categoryId = createCategory("ChurchTools")
    const tempShows: any[] = []

    // Show preview dialog first, then process on confirmation
    showImportPreview(data, categoryId, tempShows)
}

async function showImportPreview(data: ChurchToolsImportData, categoryId: string, tempShows: any[]) {
    // Match songs with existing FreeShow database
    const matchedSongs = await matchSongsWithFreeShow(data.songs)
    
    // Detect Bible verses in agenda
    const bibleVerses = detectBibleVerses(data.agenda)
    
    // Create preview data structure
    const previewData = {
        event: data.event,
        agendaItems: data.agenda.items.map((item, index) => ({
            index,
            type: item.type,
            title: item.title,
            song: item.song ? {
                ...item.song,
                matched: matchedSongs.find(m => m.churchToolsSong.id === item.song?.songId)
            } : null,
            bibleVerses: bibleVerses[index] || [],
            hasAttachment: data.eventFiles && data.eventFiles.length > 0
        })),
        songs: matchedSongs,
        serviceLeads: data.serviceLeads,
        eventFiles: data.eventFiles,
        bibleVerses
    }

    // Store preview data for the UI
    importPreviewData.set(previewData)
    
    // Open preview popup
    activePopup.set("churchtools_import_preview")
}

// Store for preview data (will need to be added to stores)
import { writable } from "svelte/store"
export const importPreviewData = writable<any>(null)

async function matchSongsWithFreeShow(churchToolsSongs: ChurchToolsSong[]): Promise<MatchedSong[]> {
    const freeShowShows = get(shows)
    const results: MatchedSong[] = []

    for (const ctSong of churchToolsSongs) {
        let bestMatch: MatchedSong = {
            churchToolsSong: ctSong,
            confidence: 0,
            matchType: "none"
        }

        // Try CCLI match first (most reliable)
        if (ctSong.ccli) {
            for (const [id, show] of Object.entries(freeShowShows)) {
                if (show.meta?.CCLI === ctSong.ccli) {
                    bestMatch = {
                        churchToolsSong: ctSong,
                        freeShowShowId: id,
                        freeShowShowName: show.name,
                        confidence: 100,
                        matchType: "ccli"
                    }
                    break
                }
            }
        }

        // If no CCLI match, try title + artist
        if (bestMatch.confidence < 100) {
            for (const [id, show] of Object.entries(freeShowShows)) {
                const showTitle = show.name.toLowerCase().trim()
                const ctTitle = ctSong.name.toLowerCase().trim()
                const showArtist = (show.meta?.artist || "").toLowerCase().trim()
                const ctArtist = (ctSong.author || "").toLowerCase().trim()

                if (showTitle === ctTitle) {
                    if (showArtist && ctArtist && showArtist === ctArtist) {
                        bestMatch = {
                            churchToolsSong: ctSong,
                            freeShowShowId: id,
                            freeShowShowName: show.name,
                            confidence: 95,
                            matchType: "title_artist"
                        }
                        break
                    } else if (!showArtist || !ctArtist) {
                        bestMatch = {
                            churchToolsSong: ctSong,
                            freeShowShowId: id,
                            freeShowShowName: show.name,
                            confidence: 85,
                            matchType: "title_only"
                        }
                    }
                }
            }
        }

        results.push(bestMatch)
    }

    return results
}

function detectBibleVerses(agenda: ChurchToolsAgenda): string[][] {
    const verseRegex = /\b([1-3]?\s?[A-Za-zÄÖÜäöüß]+\s+\d+:\d+(?:-\d+)?(?:,\s*\d+:\d+(?:-\d+)?)*|[A-Za-zÄÖÜäöüß]+\s+\d+:\d+(?:-\d+)?)\b/g
    const results: string[][] = []

    for (const item of agenda.items) {
        const verses: string[] = []
        const text = item.title + " " + (item.type === "text" ? item.title : "")
        
        let match
        while ((match = verseRegex.exec(text)) !== null) {
            verses.push(match[1].trim())
        }
        
        results.push(verses)
    }

    return results
}

export async function processChurchToolsImport(confirmedData: any) {
    // This will be called when user confirms the preview
    // Process the confirmed data and create the FreeShow project
    
    const categoryId = createCategory("ChurchTools")
    const tempShows: any[] = []
    
    // Get attachment options from config
    const config = get(contentProviderData)
    const attachmentOptions = config.churchtools?.attachmentOptions || {}
    const importAttachments = attachmentOptions.importAttachments !== false
    const convertPptxToSlides = attachmentOptions.convertPptxToSlides !== false
    const convertPdfToSlides = attachmentOptions.convertPdfToSlides !== false
    const importImagesAsSlides = attachmentOptions.importImagesAsSlides !== false
    
    // Create main service show
    const serviceShow = createServiceShow(confirmedData, categoryId)
    if (serviceShow) tempShows.push(serviceShow)
    
    // Create song shows for unmatched songs that user wants to import
    for (const song of confirmedData.songs) {
        if (song.import && !song.matched?.freeShowShowId) {
            const songShow = createSongShow(song.churchToolsSong, categoryId)
            if (songShow) tempShows.push(songShow)
        }
    }
    
    // Create Bible verse shows
    for (const verseRef of confirmedData.bibleVerses) {
        const verseShow = createBibleVerseShow(verseRef, categoryId)
        if (verseShow) tempShows.push(verseShow)
    }
    
    // Create service team slides
    if (confirmedData.createServiceSlides) {
        const teamShow = createServiceTeamShow(confirmedData.serviceLeads, categoryId)
        if (teamShow) tempShows.push(teamShow)
    }
    
    // Handle attachments (event files)
    if (importAttachments && confirmedData.convertedFiles) {
        await handleAttachments(confirmedData.convertedFiles, categoryId, tempShows, {
            convertPptxToSlides,
            convertPdfToSlides,
            importImagesAsSlides
        })
    }
    
    setTempShows(tempShows)
    activePopup.set(null)
    alertMessage.set("")
}

async function handleAttachments(convertedFiles: any[], categoryId: string, tempShows: any[], options: { convertPptxToSlides: boolean; convertPdfToSlides: boolean; importImagesAsSlides: boolean }) {
    for (const file of convertedFiles) {
        if (!file.localPath || file.type === "error") continue
        
        try {
            if (file.type === "pdf" && options.convertPdfToSlides) {
                // Import PDF as slides using existing PDF import
                const pdfShow = await importPdfAsSlides(file.localPath, file.originalUrl, categoryId)
                if (pdfShow) tempShows.push(pdfShow)
            } else if ((file.type === "pptx" || file.type === "ppt") && options.convertPptxToSlides) {
                // PowerPoint files - they were converted to PDF, import the PDF
                const pdfShow = await importPdfAsSlides(file.localPath, file.originalUrl, categoryId)
                if (pdfShow) tempShows.push(pdfShow)
            } else if (["jpg", "jpeg", "png", "gif", "webp", "bmp"].includes(file.type) && options.importImagesAsSlides) {
                // Import image as a slide
                const imageShow = createImageSlideShow(file.localPath, file.originalUrl, categoryId)
                if (imageShow) tempShows.push(imageShow)
            }
        } catch (error) {
            console.error(`Failed to process attachment ${file.originalUrl}:`, error)
        }
    }
}

async function importPdfAsSlides(pdfPath: string, originalUrl: string, categoryId: string) {
    // Import PDF using the existing PDF import mechanism
    // This will create a show with slides for each PDF page
    sendMain(Main.PDF_TO_IMAGE, { filePath: pdfPath })
    
    // Wait for the PDF to be processed and create a show
    // The PDF import will send IMPORT2 with channel "pdf"
    // We'll create a simple show that references the PDF
    return new Promise<{ id: string; show: any } | null>((resolve) => {
        const layoutId = uid()
        const show = new ShowObj(false, categoryId, layoutId, Date.now(), false)
        show.origin = "churchtools"
        const fileName = originalUrl.split("/").pop() || "PDF"
        show.name = checkName(`Anhang: ${fileName}`, uid())
        
        // Create a slide that references the PDF
        const slideId = uid()
        const slides = {
            [slideId]: newSlide({
                items: [{
                    style: DEFAULT_ITEM_STYLE,
                    lines: [{ align: "center", text: [{ style: "heading", value: `📄 ${show.name}` }] }]
                }]
            })
        }
        
        show.slides = slides
        show.layouts = {
            [layoutId]: {
                name: "Main",
                notes: "",
                slides: [{ id: slideId }]
            }
        }
        show.media = {}
        show.meta = initializeMetadata({
            title: show.name,
            comment: `Imported from ChurchTools attachment: ${originalUrl}`
        })
        
        resolve({ id: uid(), show })
    })
}

function createImageSlideShow(imagePath: string, originalUrl: string, categoryId: string) {
    const layoutId = uid()
    const show = new ShowObj(false, categoryId, layoutId, Date.now(), false)
    show.origin = "churchtools"
    const fileName = originalUrl.split("/").pop() || imagePath.split("/").pop() || "image"
    show.name = checkName(`Bild: ${fileName}`, uid())
    
    const slideId = uid()
    const slides = {
        [slideId]: newSlide({
            items: [{
                style: DEFAULT_ITEM_STYLE,
                lines: [{ align: "center", text: [{ style: "heading", value: `🖼️ ${show.name}` }] }]
            }]
        })
    }
    
    show.slides = slides
    show.layouts = {
        [layoutId]: {
            name: "Main",
            notes: "",
            slides: [{ id: slideId }]
        }
    }
    show.media = {}
    show.meta = initializeMetadata({
        title: show.name,
        comment: `Imported from ChurchTools attachment: ${originalUrl}`
    })
    
    return { id: uid(), show }
}

function createServiceShow(data: any, categoryId: string) {
    const layoutId = uid()
    const show = new ShowObj(false, categoryId, layoutId, Date.now(), false)
    show.origin = "churchtools"
    show.name = checkName(data.event.name, uid())
    
    const slides: Record<string, Slide> = {}
    const layoutSlides: SlideData[] = []
    const media: Record<string, any> = {}
    
    // Create slides from agenda items
    for (let i = 0; i < data.agendaItems.length; i++) {
        const item = data.agendaItems[i]
        const slideId = uid()
        
        let items: Item[] = []
        
        if (item.type === "header") {
            items = [{
                style: DEFAULT_ITEM_STYLE,
                lines: [{ align: "center", text: [{ style: "heading", value: item.title }] }]
            }]
        } else if (item.type === "text") {
            items = [{
                style: DEFAULT_ITEM_STYLE,
                lines: item.title.split("\n").map((line: string) => ({ align: "", text: [{ style: "", value: line }] }))
            }]
        } else if (item.type === "song" && item.song) {
            // Link to existing song show or create reference
            if (item.song.matched?.freeShowShowId) {
                items = [{
                    style: DEFAULT_ITEM_STYLE,
                    lines: [{ align: "center", text: [{ style: "heading", value: `🎵 ${item.song.title}` }] }]
                }]
                // Could add a link/action to jump to the song show
            } else {
                items = [{
                    style: DEFAULT_ITEM_STYLE,
                    lines: [{ align: "center", text: [{ style: "heading", value: `🎵 ${item.song.title} (not imported)` }] }]
                }]
            }
        }
        
        slides[slideId] = newSlide({ items, notes: `ChurchTools Agenda Item ${i + 1}` })
        layoutSlides.push({ id: slideId })
    }
    
    show.slides = slides
    show.layouts = {
        [layoutId]: {
            name: "Main",
            notes: "",
            slides: layoutSlides
        }
    }
    show.media = media
    show.meta = initializeMetadata({
        title: data.event.name,
        comment: `Imported from ChurchTools event ${data.event.id} on ${new Date(data.event.startDate).toLocaleDateString()}`
    })
    
    return { id: uid(), show }
}

function createSongShow(ctSong: ChurchToolsSong, categoryId: string) {
    const layoutId = uid()
    const show = new ShowObj(false, categoryId, layoutId, Date.now(), false)
    show.origin = "churchtools"
    show.name = checkName(ctSong.name, uid())
    
    const slides: Record<string, Slide> = {}
    const layoutSlides: SlideData[] = []
    
    // Use the default arrangement
    const arrangement = ctSong.arrangements.find(a => a.isDefault) || ctSong.arrangements[0]
    
    if (arrangement) {
        // Parse .sng file content if available
        const sngContent = arrangement._sng_header ? arrangement._sng_header.join("\n") : ""
        
        if (sngContent) {
            // Parse SongBeamer format
            parseSongBeamerContent(sngContent, slides, layoutSlides)
        } else {
            // Create basic slides from arrangement metadata
            const slideId = uid()
            slides[slideId] = newSlide({
                items: [{
                    style: DEFAULT_ITEM_STYLE,
                    lines: [{ align: "center", text: [{ style: "heading", value: ctSong.name }] }]
                }]
            })
            layoutSlides.push({ id: slideId })
        }
    }
    
    show.slides = slides
    show.layouts = {
        [layoutId]: {
            name: "Main",
            notes: "",
            slides: layoutSlides
        }
    }
    show.media = {}
    show.meta = initializeMetadata({
        title: ctSong.name,
        artist: ctSong.author,
        copyright: ctSong.ccli ? `CCLI #${ctSong.ccli}` : undefined,
        CCLI: ctSong.ccli
    })
    
    return { id: uid(), show }
}

function parseSongBeamerContent(content: string, slides: Record<string, Slide>, layoutSlides: SlideData[]) {
    // Simple SongBeamer .sng parser
    const lines = content.split("\n")
    let currentSlideLines: string[] = []
    let inSong = false
    
    for (const line of lines) {
        const trimmed = line.trim()
        
        if (trimmed.startsWith("{") && trimmed.endsWith("}")) {
            // Section marker like {verse 1}, {chorus}, etc.
            if (currentSlideLines.length > 0) {
                const slideId = uid()
                slides[slideId] = newSlide({
                    items: [{
                        style: DEFAULT_ITEM_STYLE,
                        lines: currentSlideLines.map(l => ({ align: "", text: [{ style: "", value: l }] }))
                    }]
                })
                layoutSlides.push({ id: slideId })
                currentSlideLines = []
            }
            inSong = true
        } else if (inSong && trimmed) {
            currentSlideLines.push(trimmed)
        }
    }
    
    // Last slide
    if (currentSlideLines.length > 0) {
        const slideId = uid()
        slides[slideId] = newSlide({
            items: [{
                style: DEFAULT_ITEM_STYLE,
                lines: currentSlideLines.map(l => ({ align: "", text: [{ style: "", value: l }] }))
            }]
        })
        layoutSlides.push({ id: slideId })
    }
}

function createBibleVerseShow(verseRef: string, categoryId: string) {
    const layoutId = uid()
    const show = new ShowObj(false, categoryId, layoutId, Date.now(), false)
    show.origin = "churchtools"
    show.name = checkName(`Bibel: ${verseRef}`, uid())
    
    const slideId = uid()
    const slides = {
        [slideId]: newSlide({
            items: [{
                style: DEFAULT_ITEM_STYLE,
                lines: [{ align: "center", text: [{ style: "heading", value: verseRef }] }]
            }]
        })
    }
    
    show.slides = slides
    show.layouts = {
        [layoutId]: {
            name: "Main",
            notes: "",
            slides: [{ id: slideId }]
        }
    }
    show.media = {}
    show.meta = initializeMetadata({
        title: `Bibel: ${verseRef}`,
        comment: `Bible verse from ChurchTools import`
    })
    
    return { id: uid(), show }
}

function createServiceTeamShow(serviceLeads: ChurchToolsServiceLead[], categoryId: string) {
    const layoutId = uid()
    const show = new ShowObj(false, categoryId, layoutId, Date.now(), false)
    show.origin = "churchtools"
    show.name = checkName("Mitarbeiter / Service Team", uid())
    
    const slides: Record<string, Slide> = {}
    const layoutSlides: SlideData[] = []
    
    // Title slide
    const titleSlideId = uid()
    slides[titleSlideId] = newSlide({
        items: [{
            style: DEFAULT_ITEM_STYLE,
            lines: [{ align: "center", text: [{ style: "heading", value: "Mitarbeiter / Service Team" }] }]
        }]
    })
    layoutSlides.push({ id: titleSlideId })
    
    // One slide per service with person images
    for (const lead of serviceLeads) {
        const slideId = uid()
        
        // Create items for each person with their image
        const personItems = lead.persons.map(person => {
            const items = []
            
            // Add person image if available
            if (person.imageUrl) {
                items.push({
                    style: DEFAULT_ITEM_STYLE,
                    lines: [{ align: "center", text: [{ style: "image", value: person.imageUrl, width: 80, height: 80, borderRadius: "50%" }] }]
                })
            }
            
            // Add person name
            items.push({
                style: DEFAULT_ITEM_STYLE,
                lines: [{ align: "center", text: [{ style: "heading", value: person.fullname }] }]
            })
            
            // Add role/shortname if different
            if (person.shortname && person.shortname !== person.fullname.split(" ")[0]) {
                items.push({
                    style: DEFAULT_ITEM_STYLE,
                    lines: [{ align: "center", text: [{ style: "italic", value: person.shortname }] }]
                })
            }
            
            return items
        })
        
        // Flatten all person items
        const allItems = personItems.flat()
        
        // Add service name as heading at the top
        const serviceItems = [{
            style: DEFAULT_ITEM_STYLE,
            lines: [{ align: "center", text: [{ style: "heading", value: lead.serviceName }] }]
        }, ...allItems]
        
        slides[slideId] = newSlide({
            items: serviceItems
        })
        layoutSlides.push({ id: slideId })
    }
    
    show.slides = slides
    show.layouts = {
        [layoutId]: {
            name: "Main",
            notes: "",
            slides: layoutSlides
        }
    }
    show.media = {}
    show.meta = initializeMetadata({
        title: "Mitarbeiter / Service Team",
        comment: `Service team from ChurchTools import`
    })
    
    return { id: uid(), show }
}