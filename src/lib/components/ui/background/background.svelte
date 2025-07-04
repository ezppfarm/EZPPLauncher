<script lang="ts">
  const prop: { beatmapId: number } = $props();
</script>

<div class="absolute w-screen h-screen overflow-hidden pointer-events-none rounded">
  <div
    style="background: url(https://osu.direct/api/media/background/{prop.beatmapId})"
    class="absolute top-0 left-0 w-full h-full !bg-cover -z-10 pointer-events-none blur opacity-10 rounded"
  ></div>
</div>
