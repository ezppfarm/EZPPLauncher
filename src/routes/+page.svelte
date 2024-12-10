<script lang="ts">
  import Background from "@/components/ui/background/background.svelte";
  import Button from "@/components/ui/button/button.svelte";
  import Logo from "@/components/ui/logo/logo.svelte";
  import * as Avatar from "@/components/ui/avatar";
  import Progressbar from "@/components/ui/progressbar/progressbar.svelte";
  import AvatarImage from "@/components/ui/avatar/avatar-image.svelte";
  import AvatarFallback from "@/components/ui/avatar/avatar-fallback.svelte";

  let progress = $state(0);
</script>

<div class="relative h-screen w-screen">
  <Background />
  <div class="absolute top-2 right-2 py-7">
    <Avatar.Root>
      <Avatar.AvatarFallback>U</Avatar.AvatarFallback>
      <Avatar.AvatarImage src="https://a.ez-pp.farm/1001"></Avatar.AvatarImage>
    </Avatar.Root>
  </div>
  <div
    class="absolute top-0 left-0 py-7 w-full h-screen flex flex-col gap-16 items-center justify-end"
  >
    <Logo />
    <div class="flex flex-row gap-1 items-center">
      <Progressbar loadingText="Waiting for launch..." {progress} indeterminate={false} />
      <Button
        onclick={() => {
          console.log(progress);
          if (progress >= 100) {
            progress = 0;
          } else {
            progress += 10;
          }
        }}>Launch</Button
      >
    </div>
  </div>
</div>
