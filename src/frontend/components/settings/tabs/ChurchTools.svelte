<script lang="ts">
    import { onMount } from "svelte"
    import { Main } from "../../../../types/IPC/Main"
    import { requestMain, sendMain } from "../../../IPC/main"
    import { activePage, activePopup, cloudSyncData, contentProviderData, providerConnections, projectTemplates, saved, special } from "../../../stores"
    import { translateText } from "../../../utils/language"
    import { contentProviderSync } from "../../../utils/startup"
    import { keysToID, sortByName } from "../../helpers/array"
    import Icon from "../../helpers/Icon.svelte"
    import T from "../../helpers/T.svelte"
    import InputRow from "../../input/InputRow.svelte"
    import Title from "../../input/Title.svelte"
    import MaterialButton from "../../inputs/MaterialButton.svelte"
    import MaterialTextInput from "../../inputs/MaterialTextInput.svelte"
    import MaterialToggleSwitch from "../../inputs/MaterialToggleSwitch.svelte"
    import MaterialDropdown from "../../inputs/MaterialDropdown.svelte"
    import Tip from "../../main/Tip.svelte"
    import HRule from "../../input/HRule.svelte"

    let baseUrl = ""
    let clientId = ""
    let clientSecret = ""
    let testResult: { success: boolean; message: string } | null = null
    let placeholderText = JSON.stringify({"Max Mustermann": "Max M.", "Erika Musterfrau": "Erika M."}, null, 2)
    let testing = false

    onMount(() => {
        loadConfig()
    })

    async function loadConfig() {
        const config = $contentProviderData.churchtools || {}
        baseUrl = config.baseUrl || ""
        clientId = config.clientId || ""
        clientSecret = config.clientSecret || ""
        
        // Set sensible defaults for import options if not already set
        if (!config.importOptions) {
            updateConfig("importOptions", {
                downloadFiles: true,
                downloadSongs: true,
                uploadSongSheets: false,
                createServiceSlides: true,
                createAppointmentSlides: false,
                assignBackgrounds: true,
                convertPptxToPdf: true
            })
        }
        if (config.autoImport === undefined) {
            updateConfig("autoImport", false)
        }
    }

    function updateConfig(key: string, value: any) {
        contentProviderData.update((a) => {
            if (!a.churchtools) a.churchtools = {}
            a.churchtools[key] = value
            return a
        })
        saved.set(false)
    }

    async function testConnection() {
        if (!baseUrl || !clientId || !clientSecret) {
            testResult = { success: false, message: translateText("churchtools.enter_credentials") }
            return
        }

        testing = true
        testResult = { success: false, message: translateText("churchtools.testing_connection") }
        
        try {
            const result = await requestMain(Main.CHURCHTOOLS_TEST_CONNECTION, { baseUrl, clientId, clientSecret })
            testResult = result || { success: false, message: translateText("churchtools.no_response") }
        } catch (error) {
            testResult = { success: false, message: `${translateText("churchtools.error")}: ${error}` }
        } finally {
            testing = false
        }
    }

    async function connectChurchTools() {
        if (!baseUrl || !clientId || !clientSecret) {
            testResult = { success: false, message: translateText("churchtools.enter_credentials") }
            return
        }

        // Save config first
        updateConfig("baseUrl", baseUrl)
        updateConfig("clientId", clientId)
        updateConfig("clientSecret", clientSecret)

        // Connect - will trigger OAuth flow
        sendMain(Main.PROVIDER_LOAD_SERVICES, { providerId: "churchtools", cloudOnly: false, data: { baseUrl, clientId, clientSecret } })
    }

    async function disconnectChurchTools() {
        sendMain(Main.PROVIDER_DISCONNECT, { providerId: "churchtools" })
    }

    function syncChurchTools() {
        contentProviderSync()
        activeShow.set(null)
        activePage.set("show")
    }

    $: projectTemplateOptions = [{ value: "", label: translateText("main.none") }, ...sortByName(keysToID($projectTemplates)).map(({ id, name }) => ({ value: id, label: name }))]

    $: providerOriginOptions = [
        { value: "", label: translateText("churchtools.ask_when_existing") },
        { value: "local", label: translateText("churchtools.always_local") },
        { value: "online", label: translateText("churchtools.always_online") }
    ]
</script>

{#if !$providerConnections.churchtools}
    <!-- ChurchTools not connected - show configuration -->
    <div class="settings-section">
        <Title label="settings.churchtools" icon="churchtools" />

        <Tip type="info" value={translateText("settings.churchtools_info")} />

        <div class="connection-form">
            <InputRow>
                <MaterialTextInput
                    label="Base URL"
                    placeholder="https://your-church.churchtools.de"
                    value={baseUrl}
                    on:change={(e) => {
                        baseUrl = e.detail
                        updateConfig("baseUrl", baseUrl)
                    }}
                />
            </InputRow>

            <InputRow>
                <MaterialTextInput
                    label="Client ID"
                    placeholder="Your OAuth Client ID"
                    value={clientId}
                    on:change={(e) => {
                        clientId = e.detail
                        updateConfig("clientId", clientId)
                    }}
                />
            </InputRow>

            <InputRow>
                <MaterialTextInput
                    label="Client Secret"
                    type="password"
                    placeholder="Your OAuth Client Secret"
                    value={clientSecret}
                    on:change={(e) => {
                        clientSecret = e.detail
                        updateConfig("clientSecret", clientSecret)
                    }}
                />
            </InputRow>
        </div>

        <InputRow>
            <MaterialButton on:click={testConnection} style="flex: 1;" icon="test" disabled={testing}>
                <Icon id={testing ? "loader" : "test"} class={testing ? "spin" : ""} />
                <T id={testing ? "churchtools.testing_connection" : "settings.test_connection"} />
            </MaterialButton>
        </InputRow>

        {#if testResult}
            <Tip type={testResult.success ? "success" : "error"} value={testResult.message} />
        {/if}

        <InputRow>
            <MaterialButton on:click={connectChurchTools} class="primary-action" icon="login" disabled={!baseUrl || !clientId || !clientSecret || testing}>
                <T id="settings.connect_to" replace={["ChurchTools"]} />
            </MaterialButton>
        </InputRow>

        <HRule />

        <Title label="settings.churchtools_advanced" icon="settings" />

        <InputRow>
            <MaterialTextInput
                label="Name Replacements (JSON)"
                placeholder={placeholderText}
                value={JSON.stringify($contentProviderData.churchtools?.replacements || {}, null, 2)}
                on:change={(e) => {
                    try {
                        const replacements = JSON.parse(e.detail)
                        updateConfig("replacements", replacements)
                    } catch {
                        // Invalid JSON, ignore
                    }
                }}
                multiline
                rows={3}
            />
        </InputRow>

        <InputRow>
            <MaterialToggleSwitch
                label="settings.auto_import"
                checked={$contentProviderData.churchtools?.autoImport === true}
                on:change={(e) => updateConfig("autoImport", e.detail)}
            />
        </InputRow>

        <Tip value="settings.churchtools_auto_import_tip" />
    </div>
{:else}
    <!-- ChurchTools connected -->
    <div class="settings-section">
        <div class="connected-header">
            <Title label="settings.churchtools" icon="churchtools" />
            <span class="connected-badge">
                <Icon id="check-circle" size={1} />
                {translateText("settings.connected")}
            </span>
        </div>

        <InputRow>
            <MaterialButton on:click={disconnectChurchTools} variant="outlined" icon="logout">
                <T id="settings.disconnect_from" replace={["ChurchTools"]} />
            </MaterialButton>
            <MaterialButton icon="cloud_sync" on:click={syncChurchTools}>
                <T id="cloud.sync" />
            </MaterialButton>
            <MaterialButton on:click={() => sendMain(Main.URL, "https://churchtools.de")} title="ChurchTools" variant="outlined">
                <Icon id="external-link" />
            </MaterialButton>
        </InputRow>

        <InputRow>
            <MaterialToggleSwitch
                label="settings.auto_sync_startup"
                checked={$contentProviderData.churchtools?.autoImport !== false}
                on:change={(e) => updateConfig("autoImport", e.detail)}
            />
        </InputRow>

        <HRule />

        <Title label="settings.churchtools_import_options" icon="settings" />

        <InputRow>
            <MaterialToggleSwitch
                label="settings.import_files"
                checked={$contentProviderData.churchtools?.importOptions?.downloadFiles !== false}
                on:change={(e) => updateConfig("importOptions", { ...($contentProviderData.churchtools?.importOptions || {}), downloadFiles: e.detail })}
            />
        </InputRow>

        <InputRow>
            <MaterialToggleSwitch
                label="settings.import_songs"
                checked={$contentProviderData.churchtools?.importOptions?.downloadSongs !== false}
                on:change={(e) => updateConfig("importOptions", { ...($contentProviderData.churchtools?.importOptions || {}), downloadSongs: e.detail })}
            />
        </InputRow>

        <InputRow>
            <MaterialToggleSwitch
                label="settings.import_song_sheets"
                checked={$contentProviderData.churchtools?.importOptions?.uploadSongSheets !== false}
                on:change={(e) => updateConfig("importOptions", { ...($contentProviderData.churchtools?.importOptions || {}), uploadSongSheets: e.detail })}
            />
        </InputRow>

        <InputRow>
            <MaterialToggleSwitch
                label="settings.create_service_slides"
                checked={$contentProviderData.churchtools?.importOptions?.createServiceSlides !== false}
                on:change={(e) => updateConfig("importOptions", { ...($contentProviderData.churchtools?.importOptions || {}), createServiceSlides: e.detail })}
            />
        </InputRow>

        <InputRow>
            <MaterialToggleSwitch
                label="settings.create_appointment_slides"
                checked={$contentProviderData.churchtools?.importOptions?.createAppointmentSlides !== false}
                on:change={(e) => updateConfig("importOptions", { ...($contentProviderData.churchtools?.importOptions || {}), createAppointmentSlides: e.detail })}
            />
        </InputRow>

        <InputRow>
            <MaterialToggleSwitch
                label="settings.assign_backgrounds"
                checked={$contentProviderData.churchtools?.importOptions?.assignBackgrounds !== false}
                on:change={(e) => updateConfig("importOptions", { ...($contentProviderData.churchtools?.importOptions || {}), assignBackgrounds: e.detail })}
            />
        </InputRow>

        <InputRow>
            <MaterialToggleSwitch
                label="settings.convert_pptx_to_pdf"
                checked={$contentProviderData.churchtools?.importOptions?.convertPptxToPdf !== false}
                on:change={(e) => updateConfig("importOptions", { ...($contentProviderData.churchtools?.importOptions || {}), convertPptxToPdf: e.detail })}
            />
        </InputRow>

        <HRule />

        <Title label="settings.churchtools_attachment_options" icon="attachment" />

        <InputRow>
            <MaterialToggleSwitch
                label="settings.import_attachments"
                checked={$contentProviderData.churchtools?.attachmentOptions?.importAttachments !== false}
                on:change={(e) => updateConfig("attachmentOptions", { ...($contentProviderData.churchtools?.attachmentOptions || {}), importAttachments: e.detail })}
            />
        </InputRow>

        <InputRow>
            <MaterialToggleSwitch
                label="settings.convert_pptx_to_slides"
                checked={$contentProviderData.churchtools?.attachmentOptions?.convertPptxToSlides !== false}
                on:change={(e) => updateConfig("attachmentOptions", { ...($contentProviderData.churchtools?.attachmentOptions || {}), convertPptxToSlides: e.detail })}
            />
        </InputRow>

        <InputRow>
            <MaterialToggleSwitch
                label="settings.convert_pdf_to_slides"
                checked={$contentProviderData.churchtools?.attachmentOptions?.convertPdfToSlides !== false}
                on:change={(e) => updateConfig("attachmentOptions", { ...($contentProviderData.churchtools?.attachmentOptions || {}), convertPdfToSlides: e.detail })}
            />
        </InputRow>

        <InputRow>
            <MaterialToggleSwitch
                label="settings.import_images_as_slides"
                checked={$contentProviderData.churchtools?.attachmentOptions?.importImagesAsSlides !== false}
                on:change={(e) => updateConfig("attachmentOptions", { ...($contentProviderData.churchtools?.attachmentOptions || {}), importImagesAsSlides: e.detail })}
            />
        </InputRow>

        <InputRow>
            <MaterialTextInput
                label="settings.max_attachment_size_mb"
                placeholder="50"
                value={$contentProviderData.churchtools?.attachmentOptions?.maxAttachmentSizeMB || 50}
                on:change={(e) => updateConfig("attachmentOptions", { ...($contentProviderData.churchtools?.attachmentOptions || {}), maxAttachmentSizeMB: parseInt(e.detail) || 50 })}
            />
        </InputRow>

        <HRule />

        <Title label="settings.churchtools_advanced" icon="settings" />

        <InputRow>
            <MaterialTextInput
                label="Name Replacements (JSON)"
                placeholder={placeholderText}
                value={JSON.stringify($contentProviderData.churchtools?.replacements || {}, null, 2)}
                on:change={(e) => {
                    try {
                        const replacements = JSON.parse(e.detail)
                        updateConfig("replacements", replacements)
                    } catch {
                        // Invalid JSON, ignore
                    }
                }}
                multiline
                rows={3}
            />
        </InputRow>

        <InputRow>
            <MaterialDropdown
                label="Song origin"
                options={providerOriginOptions}
                value={$contentProviderData.churchtools?.songOrigin || ""}
                on:change={(e) => updateConfig("songOrigin", e.detail)}
            />
        </InputRow>

        {#if Object.keys($projectTemplates).length}
            <InputRow>
                <MaterialDropdown
                    label="actions.project_template"
                    options={projectTemplateOptions}
                    value={$contentProviderData.churchtools?.projectTemplate || ""}
                    on:change={(e) => updateConfig("projectTemplate", e.detail)}
                />
            </InputRow>
        {/if}
    </div>
{/if}

<style>
    .settings-section {
        display: flex;
        flex-direction: column;
        gap: 16px;
    }

    .connected-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 8px;
    }

    .connected-badge {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        padding: 4px 12px;
        border-radius: 16px;
        background: var(--success-lightest);
        color: var(--success);
        font-size: 0.85em;
        font-weight: 500;
    }

    .connection-form {
        display: flex;
        flex-direction: column;
        gap: 12px;
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
</style>