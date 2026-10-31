// The internal client module is intentionally untyped in Svelte's package
// exports. Theme components only need its namespace at runtime, so treat it as
// an opaque module rather than importing private implementation types.
declare module 'svelte/internal/client';
declare module 'svelte/internal/flags/legacy';
