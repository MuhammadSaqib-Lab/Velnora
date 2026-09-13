/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Base URL of the Velnora backend API, e.g. http://localhost:4000/api */
  readonly VITE_API_URL?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
