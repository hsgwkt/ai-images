<script lang="ts">
  import type { Snippet } from 'svelte'
  import type { Attachment } from 'svelte/attachments'

  let { images, highlight = false, children }: { images: (Blob | string)[]; highlight?: boolean; children?: Snippet } = $props()

  function imageSrc(image: Blob | string): Attachment<HTMLImageElement> {
    return (element) => {
      if (typeof image === 'string') {
        element.src = image
        return
      }
      const url = URL.createObjectURL(image)
      element.src = url
      return () => URL.revokeObjectURL(url)
    }
  }

  async function handleDoubleClick(e: MouseEvent) {
    e.preventDefault()

    const targetImage = (e.target instanceof HTMLElement && e.target.closest('img')) || null

    if (document.fullscreenElement) {
      document.exitFullscreen()
    } else {
      await refContainer.requestFullscreen()
      targetImage?.scrollIntoView({ behavior: 'instant' })
    }
  }

  let refContainer: HTMLDivElement
</script>

<div class="container" bind:this={refContainer} class:highlight>
  <div class="items" ondblclick={handleDoubleClick} role="button" tabindex="0">
    {#each images as image (image)}
      <img alt="" {@attach imageSrc(image)} />
    {/each}
    {@render children?.()}
  </div>
</div>

<style>
  .container {
    width: stretch;
    height: 16rem;
    container-type: size;
    user-select: none;
    resize: vertical;
    overflow: hidden;
    background-color: #00000008;

    &.highlight:fullscreen {
      background-color: #444;
    }
  }

  .items {
    container-type: scroll-state;
    display: flex;
    width: stretch;
    height: stretch;
    gap: 0.1rem;
    overflow-x: scroll;
    scroll-snap-type: x mandatory;
    anchor-name: --carousel;
    scroll-behavior: smooth;
    scrollbar-width: none;

    &::scroll-button(*) {
      border: 0;
      line-height: 2.5rem;
      width: 1lh;
      height: 1lh;
      padding: 0;
      text-align: center;
      font-size: 1.5rem;
      color: #000c;
      opacity: 0.7;
      cursor: pointer;
      position: absolute;
      position-anchor: --carousel;
      position-area: center;
      align-self: center;
      border-radius: 999px;
      background-color: #fff8;
    }

    &::scroll-button(left) {
      content: '◄';
      justify-self: start;
      padding-right: 0.2rem;
      left: 0.5rem;
    }

    &::scroll-button(right) {
      content: '►';
      justify-self: end;
      padding-left: 0.2rem;
      right: 0.5rem;
    }

    &::scroll-button(*):hover,
    &::scroll-button(*):focus {
      opacity: 1;
    }

    &::scroll-button(*):disabled {
      display: none;
    }

    :fullscreen & {
      gap: 0;
    }
  }

  img {
    flex: none;
    display: block;
    height: 100%;
    width: auto;
    max-width: 100cqh;
    margin: 0;
    padding: 0;
    border: none;
    outline: none;
    box-shadow: none;
    object-fit: contain;

    :fullscreen & {
      width: 100vw;
      max-width: none;
    }
  }

  @container scroll-state(scrollable: left) {
    img {
      scroll-snap-align: center;
    }
  }
</style>
