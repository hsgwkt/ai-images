// See https://svelte.dev/docs/kit/types#app.d.ts
// for information about these interfaces
declare global {
  namespace App {
    // interface Error {}
    // interface Locals {}
    interface LayoutData {
      /** `loadToastError` / `loadToastSuccess` を `+layout.ts` の `return` に spread したときに付く */
      loadToast?: import('$lib/toast').LoadToast
    }
    interface PageData {
      /** `loadToastError` / `loadToastSuccess` を `+page.ts` の `return` に spread したときに付く */
      loadToast?: import('$lib/toast').LoadToast
    }
    // interface PageState {}
    // interface Platform {}
  }
}

export {}
