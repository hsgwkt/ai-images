<script lang="ts">
  import { groupLorasByFolder, splitTriggerWords, withoutExt, type Model } from '$lib/comfyui'
  import type { GenImageInputs } from '$lib/gen-image'
  import blankImageUrl from '$lib/assets/blank.png'

  let {
    selected = $bindable(),
    loraSettings = $bindable(),
    loras,
  }: {
    selected: string[]
    loraSettings: GenImageInputs['loraSettings']
    loras: Model[]
  } = $props()

  const uid = $props.id()
  const groupedLoraEntries = $derived(groupLorasByFolder(loras))
  const selectedSet = $derived(new Set(selected))

  function sanitizeId(str: string) {
    return str.replace(/[^a-zA-Z0-9]/g, '-') || 'lora'
  }

  function ensureSettings(filePath: string) {
    let settings = loraSettings[filePath]
    if (!settings) {
      settings = { strength: 1, triggerWord: [0] }
      loraSettings[filePath] = settings
    }
    return settings
  }

  function toggleSelected(filePath: string, on: boolean) {
    const index = selected.indexOf(filePath)
    if (on && index < 0) selected.push(filePath)
    if (!on && index >= 0) selected.splice(index, 1)
  }

  function selectExclusive(lora: Model, folderLoras: Model[]) {
    if (selected.includes(lora.filePath)) {
      selected.splice(selected.indexOf(lora.filePath), 1)
      return
    }
    const folderPaths = new Set(folderLoras.map((item) => item.filePath))
    for (let i = selected.length - 1; i >= 0; i--) {
      if (folderPaths.has(selected[i])) selected.splice(i, 1)
    }
    selected.push(lora.filePath)
  }

  function triggerIndexes(filePath: string) {
    return loraSettings[filePath]?.triggerWord ?? [0]
  }

  function settingsBadge(lora: Model) {
    const strength = loraSettings[lora.filePath]?.strength ?? 1
    const total = lora.triggerWords.length
    return strength === 1 ? String(total) : `${strength} ${total}`
  }

  function toggleTriggerGroup(filePath: string, groupIndex: number) {
    const settings = ensureSettings(filePath)
    const index = settings.triggerWord.indexOf(groupIndex)
    if (index < 0) settings.triggerWord.push(groupIndex)
    else settings.triggerWord.splice(index, 1)
  }
</script>

{#each groupedLoraEntries as [folder, folderLoras] (folder)}
  {#if folderLoras?.length}
    {#if folder}
      <h3>{folder}</h3>
    {/if}
    <div class="tiles">
      {#each folderLoras as lora (lora.filePath)}
        {@const id = sanitizeId(lora.filePath)}
        {@const settings = loraSettings[lora.filePath]}
        {@const name = withoutExt(lora.fileName)}
        <div class={['lora', selectedSet.has(lora.filePath) && 'on']}>
          <input
            class="on"
            type="checkbox"
            checked={selectedSet.has(lora.filePath)}
            aria-label={name}
            onchange={(e) => toggleSelected(lora.filePath, e.currentTarget.checked)}
          />
          <button
            type="button"
            class="strength"
            style:anchor-name="--{uid}-strength-{id}"
            commandfor="{uid}-settings-{id}"
            command="toggle-popover"
            aria-label="重みとトリガー">{settingsBadge(lora)}</button
          >
          <button type="button" class="select" title={name} onclick={() => selectExclusive(lora, folderLoras ?? [])}>
            <img
              src={lora.previewUrl || blankImageUrl}
              alt=""
              loading="lazy"
              onerror={(e) => {
                if (e.currentTarget instanceof HTMLImageElement) e.currentTarget.src = blankImageUrl
              }}
            />
            <span>{name}</span>
          </button>
          <div id="{uid}-settings-{id}" class="settings" popover style:position-anchor="--{uid}-strength-{id}">
            <label>
              Strength
              <input
                type="number"
                value={settings?.strength ?? 1}
                step="0.1"
                min="0"
                onkeydown={(e) => {
                  if (e.key === 'Enter') e.preventDefault()
                }}
                oninput={(e) => {
                  const value = e.currentTarget.valueAsNumber
                  ensureSettings(lora.filePath).strength = Number.isFinite(value) ? Math.max(value, 0) : 1
                }}
              />
            </label>
            {#each lora.triggerWords as triggerGroup, groupIndex (triggerGroup)}
              <label>
                <input
                  type="checkbox"
                  checked={triggerIndexes(lora.filePath).includes(groupIndex)}
                  onchange={() => toggleTriggerGroup(lora.filePath, groupIndex)}
                />
                {splitTriggerWords(triggerGroup).join(', ') || triggerGroup}
              </label>
            {/each}
          </div>
        </div>
      {/each}
    </div>
  {/if}
{/each}

<style>
  h3 {
    margin: 0.8rem 0 0.2rem;
    font-size: 0.8em;
    font-weight: normal;
  }

  .tiles {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(4rem, 1fr));
    gap: 0.2rem;
  }

  .lora {
    position: relative;
    font-size: 0.6em;
  }

  .on[type='checkbox'] {
    position: absolute;
    z-index: 1;
    top: 0.1rem;
    left: 0.1rem;
    margin: 0;
  }

  .strength {
    position: absolute;
    z-index: 1;
    top: 0.1rem;
    right: 0.1rem;
    margin: 0;
    padding: 0 0.25rem;
    border: none;
    border-radius: 0.2rem;
    color: #fff;
    background-color: rgba(0, 0, 0, 0.6);
    line-height: 1.4;
    white-space: nowrap;
    text-align: right;
    font-variant-numeric: tabular-nums;
  }

  .select {
    position: relative;
    display: block;
    width: stretch;
    padding: 0;
  }

  .lora.on .select {
    outline: 2px solid highlight;
    outline-offset: -2px;
  }

  img {
    display: block;
    width: stretch;
    aspect-ratio: 1;
    object-fit: cover;
    background-color: #ccc;
    border-radius: 0.1rem;
  }

  .select span {
    position: absolute;
    inset: auto 0 0;
    color: #fff;
    background-color: rgba(0, 0, 0, 0.5);
    line-height: 1.1;
    max-height: 1lh;
    display: block;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    box-sizing: content-box;
    padding: 0.1rem;
  }

  .settings {
    margin: 0;
    position-area: bottom span-left;
    position-try-fallbacks: flip-block, flip-inline;
    width: max(12rem, anchor-size(width));
    padding: 0.5rem;
    font-size: 0.8rem;

    label {
      display: flex;
      align-items: baseline;
      gap: 0.3rem;
      margin: 0.3rem 0;
    }

    input[type='number'] {
      width: 4rem;
    }
  }
</style>
