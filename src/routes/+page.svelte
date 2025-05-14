<script lang="ts">
  import Background from "@/components/ui/background/background.svelte";
  import Button from "@/components/ui/button/button.svelte";
  import Logo from "@/components/ui/logo/logo.svelte";
  import * as Avatar from "@/components/ui/avatar";
  import Progressbar from "@/components/ui/progressbar/progressbar.svelte";
  let progress = $state(0);
  let extended = $state(false);

  let beatmapId = $state(3820896);

</script>

<div class="relative h-screen w-screen">
  <Background {beatmapId} />
  <div class="absolute top-2 right-2 py-7">
    <Avatar.Root>
      <Avatar.AvatarFallback>U</Avatar.AvatarFallback>
      <Avatar.AvatarImage src="https://a.ez-pp.farm/1001"></Avatar.AvatarImage>
    </Avatar.Root>
  </div>

  <div
    class="absolute top-0 left-0 py-3 w-full h-screen flex flex-col gap-16 items-center justify-end overflow-hidden"
  >
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <!-- svelte-ignore a11y_click_events_have_key_events -->
    <Logo {beatmapId} {extended} onclick={() => (extended = !extended)} />
    <div
      class="{extended
        ? 'opacity-100 translate-y-0'
        : 'opacity-0 translate-y-1'} flex flex-row gap-1 items-center transition-all select-none"
    >
      <Progressbar
        loadingText="Waiting for launch..."
        {progress}
        indeterminate={false}
      />
      <Button
        onclick={() => {
          console.log(progress);
          if (progress >= 100) {
            progress = 0;
          } else {
            progress += 10;
          }
        }}
      >
        Launch
      </Button>
    </div>
  </div>
</div>
