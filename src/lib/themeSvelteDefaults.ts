/**
 * Starter source for new custom Svelte layers. Keep this plain JavaScript:
 * theme components are compiled in the WebView, without a TypeScript pass.
 */
export const DEFAULT_THEME_SVELTE_SOURCE = `<script>
  let { variables = {}, layer = {} } = $props();

  const clicks = $derived(Number(variables.clicks ?? 0));
  const player = $derived(String(variables.player ?? 'osu!'));
</script>

<div class="custom-layer">
  <span class="glow"></span>
  <p class="eyebrow">CUSTOM SVELTE LAYER</p>
  <h3>Hello, {player}</h3>
  <p class="hint">{Math.round(layer.width ?? 0)} × {Math.round(layer.height ?? 0)} · {clicks} clicks</p>
</div>

<style>
  .custom-layer {
    position: relative;
    display: flex;
    flex-direction: column;
    justify-content: center;
    height: 100%;
    padding: 22px 26px;
    overflow: hidden;
    border: 1px solid rgb(255 255 255 / 0.14);
    border-radius: 18px;
    background: linear-gradient(135deg, rgb(255 0 110 / 0.24), rgb(10 10 16 / 0.82));
    box-shadow: 0 18px 50px rgb(0 0 0 / 0.35);
    color: #fff;
    font-family: 'Sora Variable', sans-serif;
  }

  .glow {
    position: absolute;
    top: -40%;
    right: -10%;
    width: 190px;
    height: 190px;
    border-radius: 999px;
    background: #ff006e;
    filter: blur(60px);
    opacity: 0.42;
  }

  .eyebrow {
    margin: 0 0 6px;
    color: #ff9ac4;
    font-size: 10px;
    font-weight: 700;
    letter-spacing: 0.18em;
  }

  h3 {
    margin: 0;
    font-size: 30px;
    font-weight: 650;
    line-height: 1.1;
  }

  .hint {
    margin: 8px 0 0;
    color: rgb(255 255 255 / 0.62);
    font-size: 11px;
  }
</style>
`;
