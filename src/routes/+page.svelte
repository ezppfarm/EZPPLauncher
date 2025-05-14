<script lang="ts">
  import Background from "@/components/ui/background/background.svelte";
  import Button from "@/components/ui/button/button.svelte";
  import Logo from "@/components/ui/logo/logo.svelte";
  import * as Avatar from "@/components/ui/avatar";
  import * as DropdownMenu from "@/components/ui/dropdown-menu";
  import Progressbar from "@/components/ui/progressbar/progressbar.svelte";
  import Settings from "lucide-svelte/icons/settings";
  import LogOut from "lucide-svelte/icons/log-out";
  import Heart from "lucide-svelte/icons/heart";
  import { badgeVariants } from "@/components/ui/badge";
  import { twMerge } from "tailwind-merge";
  import { WebviewWindow } from "@tauri-apps/api/webviewWindow";
  let progress = $state(0);
  let extended = $state(false);

  let beatmapId = $state(3820896);
  const current = WebviewWindow.getCurrent();
  current.setAlwaysOnTop(true);
</script>

<div class="relative h-screen w-screen">
  <Background />
  <div class="absolute z-20 top-2 right-2 py-7">
    <DropdownMenu.Root>
      <DropdownMenu.Trigger>
        <div class="relative">
          <p
            class={twMerge(
              badgeVariants(),
              "p-0 h-5 w-5 absolute -right-0.5 -top-0.5 z-50 !bg-pink-600 border-2 border-pink-800 text-white"
            )}
          >
            <Heart class="h-3 w-3 m-auto p-0" />
          </p>
          <Avatar.Root class="border-[3px] z-40">
            <Avatar.AvatarFallback>U</Avatar.AvatarFallback>
            <Avatar.AvatarImage src="https://a.ez-pp.farm/1001"
            ></Avatar.AvatarImage>
          </Avatar.Root>
        </div>
      </DropdownMenu.Trigger>
      <DropdownMenu.Content class="w-48 max-w-48 mx-2" side="bottom">
        <DropdownMenu.Group>
          <DropdownMenu.GroupHeading class="truncate"
            >Hello, Quetzalcoatl!</DropdownMenu.GroupHeading
          >
          <DropdownMenu.Separator />
          <DropdownMenu.Group>
            <DropdownMenu.Item class="cursor-pointer">
              <Settings class="mr-2 size-4" />
              <span>Settings</span>
            </DropdownMenu.Item>
          </DropdownMenu.Group>
          <DropdownMenu.Separator />
          <DropdownMenu.Item class="cursor-pointer">
            <LogOut class="mr-2 size-4" />
            <span>Log out</span>
          </DropdownMenu.Item>
        </DropdownMenu.Group>
      </DropdownMenu.Content>
    </DropdownMenu.Root>
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
