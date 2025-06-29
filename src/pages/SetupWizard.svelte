<script lang="ts">
  import Logo from '$assets/logo.png';
  import * as Avatar from '@/components/ui/avatar';
  import Badge from '@/components/ui/badge/badge.svelte';
  import Button from '@/components/ui/button/button.svelte';
  import * as Select from '@/components/ui/select';
  import { beatmap_sets, online_friends, server_connection_fails, server_ping } from '@/global';
  import { WebviewWindow } from '@tauri-apps/api/webviewWindow';
  import { LoaderCircle, Logs, Music2, Play, Users, Wifi, Gamepad2, WifiOff } from 'lucide-svelte';
  import { Circle } from 'radix-icons-svelte';
  import NumberFlow from '@number-flow/svelte';
  import * as AlertDialog from '@/components/ui/alert-dialog';
  import Progress from '@/components/ui/progress/progress.svelte';
  import { numberHumanReadable } from '@/utils';

  let selectedStep = $state(1);
  const steps = [
    'Welcome',
    'Login/Register',
    'Locate your osu! Installation',
    'Select your default mode',
  ];
</script>

<div class="grid grid-cols-[0.41fr_1fr] mt-[50px] h-[calc(100vh-50px)]">
  <div class="w-full h-full border-r border-theme-800/90 flex flex-col gap-6 p-3">
    {#each steps as step, i (step)}
      <div
        class="flex flex-row items-center gap-2 border {selectedStep === i + 1
          ? 'border-primary-800/30 bg-primary-900/30'
          : 'border-theme-800 bg-theme-900'} rounded-lg p-2 transition-all"
      >
        <div
          class="flex flex-col items-center justify-center h-8 w-8 border-[2px] border-theme-600 rounded-full"
        >
          <span class="text-lg font-semibold text-theme-100">{i + 1}</span>
        </div>
        <span
          class="{selectedStep === i + 1 ? 'text-white' : 'text-muted-foreground'} transition-all"
          >{step}</span
        >
      </div>
    {/each}
  </div>
  <div class="flex flex-col gap-6 w-full h-full bg-theme-900/40 p-6">
    <div class="my-auto flex flex-col items-center justify-center">
      {#if selectedStep === 1}
        <h1 class="text-3xl">Welcome to EZPPLauncher!</h1>
        
      {/if}
    </div>
    <div class="mt-auto flex flex-row items-center justify-between">
      <Button
        class="bg-theme-950 hover:bg-theme-800"
        variant="outline"
        onclick={() => (selectedStep = Math.max(selectedStep - 1, 1))}
        disabled={selectedStep <= 1}>Previous</Button
      >
      <Button
        onclick={() => (selectedStep = Math.min(selectedStep + 1, steps.length))}
        disabled={selectedStep >= steps.length}>Next</Button
      >
    </div>
  </div>
</div>
