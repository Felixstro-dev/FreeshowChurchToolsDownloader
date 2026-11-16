import { ChurchToolsAuth } from "./ChurchToolsAuth"
import { ChurchToolsProvider } from "./ChurchToolsProvider"

/**
 * ChurchTools Export Module
 * Handles sending data to ChurchTools (e.g., songs)
 */
export class ChurchToolsExport {
  private auth: ChurchToolsAuth

  constructor(_provider: ChurchToolsProvider) {
    this.auth = (_provider as any).auth
  }

  private getHeaders(): Record<string, string> {
    return {
      Accept: "application/json",
      Authorization: `Bearer ${this.auth.getAccessToken()}`,
      "Content-Type": "application/json",
    }
  }

  /**
   * Send songs from FreeShow to ChurchTools
   * This creates or updates songs in ChurchTools song database
   */
  async sendSongsToChurchTools(songs: any[]): Promise<void> {
    console.log(`ChurchTools: Exporting ${songs.length} songs`)

    for (const song of songs) {
      try {
        await this.createOrUpdateSong(song)
      } catch (error) {
        console.error(`Failed to export song "${song.title || song.name}":`, error)
      }
    }
  }

  private async createOrUpdateSong(songData: any): Promise<void> {
    // Check if song exists by CCLI number
    // let existingSong: ChurchToolsSong | null = null

    if (songData.ccli) {
      try {
        // Search for song by CCLI - this would need a search endpoint
        // For now, we'll try to create new
      } catch {
        // Ignore
      }
    }

    // Prepare song data for ChurchTools API
    const churchToolsSong = {
      name: songData.title || songData.name,
      author: songData.artist || songData.author || "",
      ccli: songData.ccli || null,
      // Note: arrangements would need to be created separately
    }

    // Create song
    const response = await fetch(`${this.auth.getBaseUrl()}/api/songs`, {
      method: "POST",
      headers: this.getHeaders(),
      body: JSON.stringify(churchToolsSong),
    })

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`Failed to create song: ${response.status} ${errorText}`)
    }

    const result = await response.json()
    console.log(`Created song in ChurchTools: ${result.data?.id}`)
  }

  /**
   * Upload song arrangement files (.sng, .pdf) to ChurchTools
   */
  async uploadSongFiles(
    songId: number,
    arrangementId: number,
    files: Array<{ name: string; content: Blob }>
  ): Promise<void> {
    for (const file of files) {
      const formData = new FormData()
      formData.append("files[]", file.content, file.name)

      const response = await fetch(
        `${this.auth.getBaseUrl()}/api/songs/${songId}/arrangements/${arrangementId}/files`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${this.auth.getAccessToken()}`,
          },
          body: formData,
        }
      )

      if (!response.ok) {
        const errorText = await response.text()
        throw new Error(`Failed to upload file ${file.name}: ${response.status} ${errorText}`)
      }
    }
  }

  /**
   * Create a new arrangement for a song
   */
  async createArrangement(
    songId: number,
    arrangementData: {
      name: string
      isDefault?: boolean
      key?: string
      tempo?: number
      duration?: number
    }
  ): Promise<number> {
    const response = await fetch(`${this.auth.getBaseUrl()}/api/songs/${songId}/arrangements`, {
      method: "POST",
      headers: this.getHeaders(),
      body: JSON.stringify(arrangementData),
    })

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`Failed to create arrangement: ${response.status} ${errorText}`)
    }

    const result = await response.json()
    return result.data?.id
  }
}