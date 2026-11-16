<script lang="ts">
    import { onMount } from "svelte"
    import { activePopup, importPreviewData, contentProviderData } from "../../../stores"
    import { sendMain, requestMain } from "../../../IPC/main"
    import { Main } from "../../../../types/IPC/Main"
    import { translateText } from "../../../utils/language"
    import Icon from "../../helpers/Icon.svelte"
    import MaterialButton from "../../inputs/MaterialButton.svelte"
    import MaterialToggleSwitch from "../../inputs/MaterialToggleSwitch.svelte"
    import InputRow from "../../input/InputRow.svelte"
    import Title from "../../input/Title.svelte"
    import Tip from "../Tip.svelte"
    import HRule from "../../input/HRule.svelte"
    import { processChurchToolsImport } from "../../../converters/churchtools"

    // Mode: "select" for event selection, "preview" for import preview
    let mode: "select" | "preview" = "select"
    let previewData: any = null
    let events: any[] = []
    let loading = false
    let loadingEvent = false
    let importOptions = {
        createServiceSlides: true,
        createAppointmentSlides: false,
        importFiles: true,
        importSongs: true,
        uploadSongSheets: false,
        assignBackgrounds: true
    }

    onMount(() => {
        const unsubscribe = importPreviewData.subscribe((data) => {
            if (data) {
                previewData = data
                mode = "preview"
            } else {
                mode = "select"
                previewData = null
                loadEvents()
            }
        })
        return unsubscribe
    })

    async function loadEvents() {
        loading = true
        try {
            const result = await requestMain(Main.CHURCHTOOLS_GET_EVENTS, {})
            if (result?.events) {
                events = result.events
            }
        } catch (error) {
            console.error("Failed to load events:", error)
        } finally {
            loading = false
        }
    }

    async function selectEvent(event: any) {
        loadingEvent = true
        try {
            const config = $contentProviderData.churchtools || {}
            const result = await requestMain(Main.CHURCHTOOLS_IMPORT_EVENT, {
                eventId: event.id,
                config: {
                    baseUrl: config.baseUrl,
                    clientId: config.clientId,
                    clientSecret: config.clientSecret
                }
            })
            if (result.success) {
                activePopup.set(null)
            } else {
                alert("Failed to load event: " + result.message)
            }
        } catch (error) {
            console.error("Failed to load event:", error)
            alert("Failed to load event: " + error)
        } finally {
            loadingEvent = false
        }
    }

    function getMatchBadge(match: any) {
        if (!match) return { text: translateText("churchtools.no_match"), color: "var(--error)", icon: "x" }
        
        switch (match.matchType) {
            case "ccli":
                return { text: translateText("churchtools.match_ccli"), color: "var(--success)", icon: "check" }
            case "title_artist":
                return { text: translateText("churchtools.match_title_artist"), color: "var(--success)", icon: "check" }
            case "title_only":
                return { text: translateText("churchtools.match_title_only"), color: "var(--warning)", icon: "alert" }
            default:
                return { text: translateText("churchtools.no_match"), color: "var(--error)", icon: "x" }
        }
    }

    function toggleSongImport(song: any) {
        song.import = !song.import
        importPreviewData.update(d => {
            if (!d) return d
            const songIndex = d.songs.findIndex((s: any) => s.churchToolsSong.id === song.churchToolsSong.id)
            if (songIndex >= 0) {
                d.songs[songIndex].import = song.import
            }
            return d
        })
    }

    function toggleBibleVerse(verse: string, index: number) {
        importPreviewData.update(d => {
            if (!d) return d
            d.bibleVersesSelected = d.bibleVersesSelected || {}
            d.bibleVersesSelected[`${index}-${verse}`] = !d.bibleVersesSelected[`${index}-${verse}`]
            return d
        })
    }

    function toggleServiceSlide(serviceName: string) {
        importPreviewData.update(d => {
            if (!d) return d
            d.serviceSlidesSelected = d.serviceSlidesSelected || {}
            d.serviceSlidesSelected[serviceName] = !d.serviceSlidesSelected[serviceName]
            return d
        })
    }

    async function confirmImport() {
        if (!previewData) return
        
        loading = true
        try {
            const confirmedData = {
                ...previewData,
                importOptions,
                songs: previewData.songs.map((song: any) => ({
                    ...song,
                    import: song.matched?.freeShowShowId ? false : (song.import !== false)
                })),
                bibleVerses: previewData.bibleVerses.filter((verse: string) => 
                    previewData.bibleVersesSelected?.[verse] !== false
                ),
                serviceLeads: previewData.serviceLeads.filter((service: any) => 
                    previewData.serviceSlidesSelected?.[service.serviceName] !== false
                ),
                createServiceSlides: importOptions.createServiceSlides
            }
            
            processChurchToolsImport(confirmedData)
            
            activePopup.set(null)
            importPreviewData.set(null)
        } catch (error) {
            console.error("Import failed:", error)
            alert("Import fehlgeschlagen: " + error)
        } finally {
            loading = false
        }
    }

    function cancelImport() {
        activePopup.set(null)
        importPreviewData.set(null)
    }

    function goBack() {
        mode = "select"
        previewData = null
        importPreviewData.set(null)
    }

    function formatDate(dateString: string) {
        return new Date(dateString).toLocaleDateString("de-DE", {
            weekday: "long",
            day: "numeric",
            month: "long",
            year: "numeric"
        })
    }

    function formatTime(dateString: string) {
        return new Date(dateString).toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" })
    }
</script>

{#if mode === "select"}
<div class="churchtools-event-selection">
    <div class="popup-header">
        <Title label="churchtools.select_event" icon="calendar" />
        <MaterialButton variant="outlined" icon="close" on:click={cancelImport} />
    </div>

    {#if loading}
        <div class="loading-state">
            <Icon id="loader" size={2} class="spin" />
            <p>{translateText("churchtools.loading_events")}</p>
        </div>
    {:else if events.length === 0}
        <div class="empty-state">
            <Icon id="calendar" size={3} />
            <p>{translateText("churchtools.no_upcoming_events")}</p>
            <p class="hint">{translateText("churchtools.no_upcoming_events_hint")}</p>
        </div>
    {:else}
        <div class="events-list">
            {#each events as event}
                <MaterialButton
                    variant="outlined"
                    class="event-card"
                    on:click={() => selectEvent(event)}
                    disabled={loadingEvent}
                >
                    <div class="event-info">
                        <p class="event-name">{event.name}</p>
                        <p class="event-meta">
                            <Icon id="calendar" size={1} /> {formatDate(event.startDate)} · <Icon id="clock" size={1} /> {formatTime(event.startDate)}
                            {#if event.calendar}
                                · <Icon id="book-open" size={1} /> {event.calendar.title}
                            {/if}
                        </p>
                    </div>
                    <Icon id="chevron-right" size={1.5} class="chevron" />
                </MaterialButton>
            {/each}
        </div>
    {/if}
</div>
{:else if mode === "preview" && previewData}
<div class="churchtools-import-preview">
    <div class="popup-header">
        <div>
            <Title label="churchtools.import_preview" icon="list" />
            <p class="event-subtitle">{previewData.event?.name} · {formatDate(previewData.event?.startDate)}</p>
        </div>
        <div class="header-actions">
            <MaterialButton variant="outlined" icon="arrow-left" on:click={goBack} title={translateText("actions.back")} />
            <MaterialButton variant="outlined" icon="close" on:click={cancelImport} />
        </div>
    </div>

    <!-- Agenda Preview -->
    <div class="section">
        <Title label="churchtools.agenda_preview" icon="list" subtitle="{previewData.agendaItems?.length || 0} {translateText('items')}" />
        
        <div class="agenda-items">
            {#each previewData.agendaItems as item, index}
                <div class="agenda-item">
                    <div class="item-number">{index + 1}</div>
                    <div class="item-type">{translateText("churchtools.agenda_type_" + item.type)}</div>
                    <div class="item-content">
                        <p class="item-title">{item.title}</p>
                        
                        {#if item.song}
                            <div class="song-match">
                                <Icon id="music" size={1} />
                                <span>{item.song.title}</span>
                                {#if item.song.matched}
                                    <span class="match-badge" style="background: {getMatchBadge(item.song.matched).color};">
                                        <Icon id={getMatchBadge(item.song.matched).icon} size={0.8} />
                                        {getMatchBadge(item.song.matched).text}
                                    </span>
                                    {#if item.song.matched.freeShowShowName}
                                        <span class="matched-name">→ {item.song.matched.freeShowShowName}</span>
                                    {/if}
                                {:else}
                                    <span class="match-badge" style="background: var(--error);">
                                        <Icon id="x" size={0.8} />
                                        {translateText("churchtools.no_match")}
                                    </span>
                                    <MaterialToggleSwitch
                                        label={translateText("churchtools.import_this_song")}
                                        checked={item.song.import !== false}
                                        on:change={(e) => toggleSongImport(item.song)}
                                    />
                                {/if}
                            </div>
                        {/if}
                        
                        {#if item.bibleVerses && item.bibleVerses.length}
                            <div class="bible-verses">
                                {#each item.bibleVerses as verse}
                                    <span class="verse-tag">
                                        <Icon id="book" size={0.8} />
                                        {verse}
                                        <MaterialToggleSwitch
                                            checked={previewData.bibleVersesSelected?.[`${index}-${verse}`] !== false}
                                            on:change={(e) => toggleBibleVerse(verse, index)}
                                        />
                                    </span>
                                {/each}
                            </div>
                        {/if}
                    </div>
                </div>
            {/each}
        </div>
    </div>

    <!-- Songs Section -->
    <div class="section">
        <Title label="churchtools.songs" icon="music" subtitle="{previewData.songs?.length || 0} {translateText('items')}" />
        
        <div class="songs-list">
            {#each previewData.songs as song}
                <div class="song-item">
                    <div class="song-info">
                        <p class="song-name">{song.churchToolsSong.name}</p>
                        <p class="song-meta">
                            {song.churchToolsSong.author || translateText("churchtools.unknown_artist")}
                            {#if song.churchToolsSong.ccli}
                                <span class="ccli-badge">CCLI: {song.churchToolsSong.ccli}</span>
                            {/if}
                        </p>
                    </div>
                    
                    <div class="song-match-status">
                        {#if song.matched}
                            <span class="match-badge" style="background: {getMatchBadge(song.matched).color};">
                                <Icon id={getMatchBadge(song.matched).icon} size={0.8} />
                                {getMatchBadge(song.matched).text}
                            </span>
                            {#if song.matched.freeShowShowName}
                                <span class="matched-name">→ {song.matched.freeShowShowName}</span>
                            {/if}
                        {:else}
                            <span class="match-badge" style="background: var(--error);">
                                <Icon id="x" size={0.8} />
                                {translateText("churchtools.no_match")}
                            </span>
                            <MaterialToggleSwitch
                                label={translateText("churchtools.import")}
                                checked={song.import !== false}
                                on:change={(e) => toggleSongImport(song)}
                            />
                        {/if}
                    </div>
                </div>
            {/each}
        </div>
    </div>

    <!-- Bible Verses Section -->
    {#if previewData.bibleVerses && previewData.bibleVerses.length}
    <div class="section">
        <Title label="churchtools.bible_verses" icon="book" subtitle="{previewData.bibleVerses.length} {translateText('items')}" />
        
        <div class="verses-list">
            {#each previewData.bibleVerses as verse}
                <span class="verse-tag">
                    <Icon id="book" size={1} />
                    {verse}
                    <MaterialToggleSwitch
                        checked={previewData.bibleVersesSelected?.[verse] !== false}
                        on:change={(e) => toggleBibleVerse(verse, -1)}
                    />
                </span>
            {/each}
        </div>
    </div>
    {/if}

    <!-- Service Team Section -->
    {#if previewData.serviceLeads && previewData.serviceLeads.length}
    <div class="section">
        <Title label="churchtools.service_team" icon="users" subtitle="{previewData.serviceLeads.length} {translateText('items')}" />
        
        <div class="services-list">
            {#each previewData.serviceLeads as service}
                <div class="service-item">
                    <div class="service-info">
                        <p class="service-name">{service.serviceName}</p>
                        <div class="service-persons">
                            {#each service.persons as person}
                                <div class="person-row">
                                    {#if person.imageUrl}
                                        <img class="person-avatar" src="{person.imageUrl}" alt="{person.fullname}" />
                                    {/if}
                                    <span class="person-name">
                                        {person.fullname}
                                        {#if person.imageName}
                                            <span class="image-badge">{person.imageName}</span>
                                        {/if}
                                    </span>
                                </div>
                            {/each}
                        </div>
                    </div>
                    <MaterialToggleSwitch
                        label={translateText("churchtools.create_slides")}
                        checked={previewData.serviceSlidesSelected?.[service.serviceName] !== false}
                        on:change={(e) => toggleServiceSlide(service.serviceName)}
                    />
                </div>
            {/each}
        </div>
    </div>
    {/if}

    <!-- Event Files / Attachments -->
    {#if previewData.eventFiles && previewData.eventFiles.length}
    <div class="section">
        <Title label="churchtools.attachments" icon="paperclip" subtitle="{previewData.eventFiles.length} {translateText('items')}" />
        
        <div class="files-list">
            {#each previewData.eventFiles as file}
                <div class="file-item">
                    <Icon id={file.domainType === "file" ? "file" : "link"} size={1.2} />
                    <span class="file-title">{file.title}</span>
                    <span class="file-type">{file.domainType}</span>
                </div>
            {/each}
        </div>
    </div>
    {/if}

    <!-- Import Options -->
    <div class="section options-section">
        <Title label="churchtools.import_options" icon="settings" />
        
        <div class="options-grid">
            <InputRow>
                <MaterialToggleSwitch
                    label={translateText("churchtools.create_service_slides")}
                    checked={importOptions.createServiceSlides}
                    on:change={(e) => importOptions.createServiceSlides = e.detail}
                />
            </InputRow>
            <InputRow>
                <MaterialToggleSwitch
                    label={translateText("churchtools.create_appointment_slides")}
                    checked={importOptions.createAppointmentSlides}
                    on:change={(e) => importOptions.createAppointmentSlides = e.detail}
                />
            </InputRow>
            <InputRow>
                <MaterialToggleSwitch
                    label={translateText("churchtools.import_files")}
                    checked={importOptions.importFiles}
                    on:change={(e) => importOptions.importFiles = e.detail}
                />
            </InputRow>
            <InputRow>
                <MaterialToggleSwitch
                    label={translateText("churchtools.import_songs")}
                    checked={importOptions.importSongs}
                    on:change={(e) => importOptions.importSongs = e.detail}
                />
            </InputRow>
            <InputRow>
                <MaterialToggleSwitch
                    label={translateText("churchtools.upload_song_sheets")}
                    checked={importOptions.uploadSongSheets}
                    on:change={(e) => importOptions.uploadSongSheets = e.detail}
                />
            </InputRow>
            <InputRow>
                <MaterialToggleSwitch
                    label={translateText("churchtools.assign_backgrounds")}
                    checked={importOptions.assignBackgrounds}
                    on:change={(e) => importOptions.assignBackgrounds = e.detail}
                />
            </InputRow>
        </div>
    </div>

    <!-- Action Buttons -->
    <div class="popup-actions">
        <MaterialButton variant="outlined" on:click={goBack}>
            <Icon id="arrow-left" size={1.1} />
            {translateText("actions.back")}
        </MaterialButton>
        <MaterialButton on:click={confirmImport} disabled={loading} class="primary-action">
            <Icon id={loading ? "loader" : "check"} size={1.1} class={loading ? "spin" : ""} />
            {loading ? translateText("churchtools.importing") : translateText("churchtools.confirm_import")}
        </MaterialButton>
    </div>
</div>

<style>
    .churchtools-event-selection,
    .churchtools-import-preview {
        font-family: inherit;
        max-width: 900px;
        max-height: 80vh;
        overflow: auto;
    }

    .popup-header {
        display: flex;
        justify-content: space-between;
        align-items: flex-start;
        margin-bottom: 20px;
        padding-bottom: 15px;
        border-bottom: 1px solid var(--primary-lighter);
    }

    .popup-header :global(.title) {
        margin-bottom: 4px;
    }

    .event-subtitle,
    .item-meta {
        margin: 4px 0 0;
        font-size: 0.9em;
        opacity: 0.7;
    }

    .header-actions {
        display: flex;
        gap: 8px;
    }

    .loading-state,
    .empty-state {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        padding: 40px 20px;
        text-align: center;
        opacity: 0.7;
        gap: 12px;
    }

    .loading-state .spin {
        animation: spin 1s linear infinite;
    }

    .empty-state p:first-of-type {
        font-size: 1.1em;
        font-weight: 500;
    }

    .hint {
        font-size: 0.85em !important;
        opacity: 0.6;
    }

    .events-list,
    .agenda-items,
    .songs-list,
    .services-list,
    .files-list {
        display: flex;
        flex-direction: column;
        gap: 8px;
        max-height: 50vh;
        overflow: auto;
    }

    .agenda-items,
    .songs-list,
    .services-list,
    .files-list {
        max-height: 300px;
    }

    .event-card,
    .agenda-item,
    .song-item,
    .service-item,
    .file-item {
        display: flex;
        align-items: center;
        gap: 12px;
        padding: 12px 16px;
        background: var(--primary-lightest);
        border-radius: 8px;
        border: 1px solid var(--primary-lighter);
        transition: background 0.15s ease;
    }

    .event-card:hover,
    .agenda-item:hover,
    .song-item:hover,
    .service-item:hover,
    .file-item:hover {
        background: var(--primary-lighter);
    }

    .event-info,
    .item-content,
    .song-info,
    .service-info {
        flex: 1;
        min-width: 0;
    }

    .event-name,
    .item-title,
    .song-name,
    .service-name {
        margin: 0 0 4px;
        font-weight: 500;
        font-size: 1em;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
    }

    .event-meta,
    .song-meta,
    .service-persons {
        margin: 0;
        font-size: 0.85em;
        opacity: 0.7;
        display: flex;
        align-items: center;
        flex-wrap: wrap;
        gap: 8px;
    }

    .item-type {
        width: 80px;
        text-transform: capitalize;
        font-size: 0.85em;
        opacity: 0.8;
        font-weight: 500;
    }

    .item-number {
        width: 30px;
        text-align: center;
        font-weight: 600;
        color: var(--primary);
        font-size: 0.9em;
    }

    .chevron {
        opacity: 0.4;
        flex-shrink: 0;
    }

    .song-match,
    .song-match-status,
    .bible-verses {
        display: flex;
        align-items: center;
        flex-wrap: wrap;
        gap: 8px;
        margin-top: 8px;
    }

    .song-info {
        min-width: 0;
    }

    .ccli-badge {
        font-size: 0.7em;
        color: var(--primary);
        background: var(--primary-lightest);
        padding: 2px 6px;
        border-radius: 4px;
    }

    .match-badge {
        display: inline-flex;
        align-items: center;
        gap: 4px;
        padding: 2px 8px;
        border-radius: 12px;
        font-size: 0.7em;
        font-weight: 600;
        color: white;
    }

    .matched-name {
        font-size: 0.8em;
        opacity: 0.7;
    }

    .verse-tag {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        padding: 4px 10px;
        border-radius: 16px;
        font-size: 0.85em;
        background: var(--info-lightest);
        color: var(--info);
        border: 1px solid var(--info-light);
    }

    .section {
        margin-bottom: 20px;
    }

    .options-section {
        margin-bottom: 20px;
        padding: 16px;
        background: var(--primary-lightest);
        border-radius: 8px;
        border: 1px solid var(--primary-lighter);
    }

    .options-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
        gap: 12px;
    }

    .agenda-items {
        max-height: 300px;
    }

    .songs-list {
        max-height: 250px;
    }

    .services-list {
        max-height: 200px;
    }

    .files-list {
        max-height: 200px;
    }

    .popup-actions {
        display: flex;
        justify-content: flex-end;
        gap: 10px;
        padding-top: 16px;
        border-top: 1px solid var(--primary-lighter);
    }

    .primary-action {
        border-bottom: 2px solid var(--connected) !important;
    }

    .spin {
        animation: spin 1s linear infinite;
    }

    @keyframes spin {
        from { transform: rotate(0deg); }
        to { transform: rotate(360deg); }
    }

    .person-row {
        display: flex;
        align-items: center;
        gap: 8px;
        margin: 4px 0;
    }

    .person-avatar {
        width: 32px;
        height: 32px;
        border-radius: 50%;
        object-fit: cover;
        border: 1px solid var(--primary-lighter);
    }

    .person-name {
        display: flex;
        flex-direction: column;
        gap: 2px;
        min-width: 0;
    }

    .image-badge {
        font-size: 0.65em;
        color: var(--primary);
        background: var(--primary-lightest);
        padding: 1px 6px;
        border-radius: 4px;
        white-space: nowrap;
    }

    .service-persons {
        display: flex;
        flex-direction: column;
        gap: 4px;
        min-width: 0;
    }
</style>
{/if}