<script lang="ts">
  import { onMount } from 'svelte'

  import '../app.css'
  import favicon from '$lib/assets/favicon.svg'
  import { installGlobalErrorToasts } from '$lib/toast'
  import { initializeLocalStorageState } from '$lib/local-storage-state.svelte'
  import ToastHost from '$lib/components/ToastHost.svelte'
  import ApiConfigDialog from '$lib/components/ApiConfigDialog.svelte'
  import WorkflowsConfigDialog from '$lib/components/WorkflowsConfigDialog.svelte'
  import TagsConfigDialog from '$lib/components/TagsConfigDialog.svelte'

  let { children } = $props()

  initializeLocalStorageState()

  onMount(installGlobalErrorToasts)
</script>

<svelte:head>
  <link rel="icon" href={favicon} />
</svelte:head>

<header>
  <button commandfor="api-config-dialog" command="show-modal">API設定</button>
  <button commandfor="workflows-config-dialog" command="show-modal">ワークフロー設定</button>
  <button commandfor="tags-config-dialog" command="show-modal">タグ設定</button>
</header>
<main>
  {@render children()}
</main>
<footer></footer>

<ApiConfigDialog id="api-config-dialog" />
<WorkflowsConfigDialog id="workflows-config-dialog" />
<TagsConfigDialog id="tags-config-dialog" />
<ToastHost />
