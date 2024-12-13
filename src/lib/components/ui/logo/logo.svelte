<script lang="ts">
  import { onMount } from "svelte";
  import ezppLogo from "../../../../assets/logo.png";
  import { osudirect } from "@/api/osudirect";
  import { playAudio } from "@/utils";
  import { BeatmapDecoder } from "osu-parsers";

  type logoProps = {
    extended: boolean;
    onclick: () => void;
  };

  let { extended, onclick }: logoProps = $props();

  let hovered = $state(false);
  let bpm = $state(150); // 1000 * 60 / bpm
  let lastTimeout: number | undefined = undefined;

  onMount(async () => {
    const beatmapId = 2226722;
    const beatmapData = await osudirect.osu(beatmapId);
    if (beatmapData) {
      const decoder = new BeatmapDecoder();
      const beatmap = decoder.decodeFromString(beatmapData);
      console.log(beatmap);

      const audio = new Audio(
        `https://osu.direct/api/media/audio/${beatmapId}`
      );
      audio.volume = 0.3;

      // Function to play the heartbeat sound
      const playHeartbeat = () => {
        playAudio("/audio/menuHeartbeat.mp3", hovered ? 1 : 0.3);
      };

      // Function to synchronize the heartbeat with the song
      const syncHeartbeat = () => {
        const currentTime = audio.currentTime * 1000; // Convert to milliseconds
        const timingPoint = beatmap.controlPoints.timingPointAt(currentTime);
        if (timingPoint && bpm !== timingPoint.bpm) {
          bpm = timingPoint.bpm;

          if (lastTimeout) {
            clearTimeout(lastTimeout);
          }

          const interval = (1000 * 60) / bpm; // Interval in milliseconds
          const nextBeat = interval - (currentTime % interval); // Time to the next beat
          setTimeout(() => {
            playHeartbeat();
            lastTimeout = setInterval(playHeartbeat, interval);
          }, nextBeat);
        }
        // Continue syncing
        requestAnimationFrame(syncHeartbeat);
      };

      // Start playback and syncing
      audio.addEventListener("play", () => {
        syncHeartbeat();
      });

      await audio.play();
    }
  });
</script>

<div
  class="w-screen {extended
    ? hovered
      ? '-translate-y-1 scale-100'
      : '-translate-y-1 scale-90'
    : hovered
      ? 'translate-y-5 scale-150'
      : 'translate-y-5 scale-125'} transition-transform select-none"
>
  <!-- svelte-ignore a11y_click_events_have_key_events -->
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div
    class="logo-animation relative w-44 h-44 mx-auto cursor-pointer"
    onmouseenter={() => (hovered = true)}
    onmouseleave={() => (hovered = false)}
    onclick={() => {
      if (extended) {
        playAudio("/audio/menuBack.wav", 1);
      } else {
        playAudio("/audio/menuHit.wav", 1);
      }
      onclick();
    }}
  >
    <img
      class="absolute pulse-logo"
      style="animation-duration: {(1000 * 60) / bpm}ms;"
      src={ezppLogo}
      alt="logo-pulse"
    />
    <img
      class="absolute main-logo"
      style="animation-duration: {(1000 * 60) / bpm}ms;"
      src={ezppLogo}
      alt="logo"
    />
  </div>
</div>

<style lang="scss">
  .logo-animation {
    .pulse-logo {
      animation: 0.5s 0.2s infinite forwards beat-pulse;
    }
    .main-logo {
      animation: 0.5s infinite forwards beat;
    }
  }

  @keyframes beat {
    0%,
    100% {
      scale: 1.08;
    }
    90% {
      scale: 1;
    }
  }
  @keyframes beat-pulse {
    0%,
    10% {
      scale: 0.5;
      opacity: 0.5;
      filter: blur(0px);
    }
    100% {
      scale: 1.4;
      opacity: 0;
      filter: blur(2px);
    }
  }
</style>
