/** Editor-only snippets for custom Svelte layers. */
export const THEME_SVELTE_COMPONENT_SKELETON = `<script>
  let { variables = {}, layer = {}, asset } = $props();

  const score = $derived(Number(variables.score ?? 0));
</script>

<div class="custom-layer">
  <p>Score: {score}</p>
  <p>{Math.round(layer.width)} × {Math.round(layer.height)}</p>
</div>

<style>
  .custom-layer {
    display: flex;
    flex-direction: column;
    justify-content: center;
    height: 100%;
    padding: 18px 22px;
    border: 1px solid rgb(255 255 255 / 0.14);
    border-radius: 16px;
    background: linear-gradient(135deg, rgb(255 0 110 / 0.22), rgb(10 10 16 / 0.82));
    color: #fff;
    font-family: 'Sora Variable', sans-serif;
  }
</style>
`;

export const THEME_SVELTE_COMPONENT_PLACEHOLDER = `<script>
  let { variables = {} } = $props();
</script>

<div>{variables.score}</div>`;
