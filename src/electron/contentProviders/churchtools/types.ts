// import type { ContentFile, ContentLibraryCategory } from "../base/types"

/**
 * ChurchTools API Scopes
 * Based on ChurchTools REST API permissions
 */
export type ChurchToolsScopes = "calendar" | "services" | "songs" | "events" | "persons" | "files"

/**
 * ChurchTools OAuth 2.0 Configuration
 */
export interface ChurchToolsOAuthConfig {
  clientId: string
  clientSecret: string
  redirectUri: string
  authorizationUrl: string
  tokenUrl: string
}

/**
 * ChurchTools Authentication Data
 */
export interface ChurchToolsAuthData {
  access_token: string
  refresh_token: string
  token_type: "Bearer"
  created_at: number
  expires_in: number
  scope: ChurchToolsScopes
}

/**
 * ChurchTools API Request Data
 */
export interface ChurchToolsRequestData {
  endpoint: string
  authenticated: boolean
  params?: Record<string, string>
  method?: "GET" | "POST" | "PUT" | "DELETE"
  data?: any
}

/**
 * ChurchTools Event (from API)
 */
export interface ChurchToolsEvent {
  id: number
  name: string
  startDate: string
  endDate: string
  calendar?: {
    domainIdentifier: string
    title: string
  }
}

/**
 * ChurchTools Full Event with agenda and files
 */
export interface ChurchToolsEventFull extends ChurchToolsEvent {
  eventFiles: ChurchToolsEventFile[]
  eventServices: ChurchToolsEventService[]
}

/**
 * ChurchTools Event File
 */
export interface ChurchToolsEventFile {
  title: string
  domainType: "file" | "link"
  domainIdentifier: string
  frontendUrl: string
}

/**
 * ChurchTools Event Service (team member assignment)
 */
export interface ChurchToolsEventService {
  person?: {
    domainIdentifier: string
  }
  name?: string
  serviceId: number
}

/**
 * ChurchTools Service Definition
 */
export interface ChurchToolsService {
  id: number
  name: string | null
}

/**
 * ChurchTools Person
 */
export interface ChurchToolsPerson {
  id: number
  firstName: string
  lastName: string
  nickname?: string | null
  image?: {
    name: string | null
    imageUrl: string | null
  } | null
}

/**
 * ChurchTools Agenda Item
 */
export interface ChurchToolsAgendaItem {
  title: string
  type: "header" | "text" | "song"
  meta: {
    modifiedDate: string
  }
  song?: {
    songId: number
    arrangementId: number
    title: string
    arrangement: string
    key: string | null
    isDefault: boolean
  }
}

/**
 * ChurchTools Agenda
 */
export interface ChurchToolsAgenda {
  id: number
  items: ChurchToolsAgendaItem[]
}

/**
 * ChurchTools Song
 */
export interface ChurchToolsSong {
  id: number
  name: string
  author: string | null
  ccli: string | null
  arrangements: ChurchToolsArrangement[]
  tags: ChurchToolsTag[]
}

/**
 * ChurchTools Arrangement
 */
export interface ChurchToolsArrangement {
  id: number
  name: string
  isDefault: boolean
  source?: {
    name: string | null
    shorty: string | null
  }
  sourceReference: string | null
  key: string | null
  beat: string | null
  tempo: number | null
  duration: number | null
  files: ChurchToolsFile[]
  // Internal: parsed .sng header
  _sng_header?: string[]
}

/**
 * ChurchTools File
 */
export interface ChurchToolsFile {
  name: string
  fileUrl: string
}

/**
 * ChurchTools Tag
 */
export interface ChurchToolsTag {
  id: number
  name: string
}

/**
 * ChurchTools Calendar
 */
export interface ChurchToolsCalendar {
  id: number
  name: string
}

/**
 * ChurchTools Calendar Appointment
 */
export interface ChurchToolsCalendarAppointment {
  title: string
  subtitle: string | null
  description: string | null
  image: {
    name: string | null
    imageUrl: string | null
  } | null
  link: string | null
  isInternal: boolean
  startDate: string
  endDate: string
  allDay: boolean
  repeatId: number | null
  repeatFrequency: number | null
  address: {
    name: string | null
    street: string | null
    zip: string | null
    city: string | null
  } | null
}

/**
 * ChurchTools API Permissions
 */
export interface ChurchToolsPermissions {
  churchdb: {
    view: boolean
    "view alldata": number[]
    "security level person": number[]
  }
  churchcal: {
    view: boolean
    "view category": number[]
  }
  churchservice: {
    "edit events": number[]
    view: boolean
    "view servicegroup": number[]
    "view history": boolean
    "view events": number[]
    "view agenda": number[]
    "view songcategory": number[]
  }
}

/**
 * ChurchTools API Info
 */
export interface ChurchToolsInfo {
  version: string
}

/**
 * ChurchTools Song Statistics Result
 */
export interface ChurchToolsSongStatistic {
  songId: number
  title: string
  ccli: string | null
  count: number
  arrangement?: string
}

/**
 * ChurchTools Song Verification Result
 */
export interface ChurchToolsSongVerificationResult {
  title: string
  ccli: string | null
  arrangement: string
  checks: Record<string, boolean | string>
}

/**
 * ChurchTools Service Lead (for PowerPoint slide)
 */
export interface ChurchToolsServiceLead {
  serviceName: string
  persons: {
    fullname: string
    shortname: string
    imageUrl?: string | null
    imageName?: string | null
  }[]
}

/**
 * ChurchTools Configuration for FreeShow
 * Uses OAuth 2.0 Authorization Code flow with PKCE (S256)
 */
export interface ChurchToolsConfig {
  baseUrl: string
  clientId: string
  clientSecret: string
  replacements?: Record<string, string>
  autoImport?: boolean
  importOptions?: {
    downloadFiles?: boolean
    downloadSongs?: boolean
    uploadSongSheets?: boolean
    createServiceSlides?: boolean
    createAppointmentSlides?: boolean
    assignBackgrounds?: boolean
    convertPptxToPdf?: boolean
  }
  attachmentOptions?: {
    importAttachments?: boolean
    convertPptxToSlides?: boolean
    convertPdfToSlides?: boolean
    importImagesAsSlides?: boolean
    maxAttachmentSizeMB?: number
    allowedAttachmentTypes?: string[]
  }
  songOrigin?: string
  projectTemplate?: string
  songbeamer?: {
    outputDir: string
    powerpoint?: {
      services?: {
        templatePptx?: string
        portraitsDir?: string
      }
      appointments?: {
        templatePptx?: string
        lookAheadWeeks?: number
        weekly?: {
          regularDatetimeFormat?: string
          alldayDatetimeFormat?: string
          multidayDatetimeFormat?: string
          subtitlePriority?: string[]
        }
        irregular?: {
          regularDatetimeFormat?: string
          alldayDatetimeFormat?: string
          multidayDatetimeFormat?: string
          subtitlePriority?: string[]
        }
      }
    }
    slides?: {
      datetimeFormat?: string
      opening?: { content: string }
      closing?: { content: string }
      insert?: Array<{
        keywords: string[]
        content: string
      }>
    }
    color?: Record<string, { color: string; bgcolor?: string }>
  }
  immich?: {
    baseUrl: string
    loginToken: string
    includeGlobbings?: string[]
    excludeGlobbings?: string[]
    uploadTags?: string[]
    backgroundsAlbum?: string
  }
}