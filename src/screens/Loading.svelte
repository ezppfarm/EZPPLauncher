<script lang="ts">
  import Logo from '$assets/logo.png';
  import { estimateRefreshRate } from '@/displayUtils';
  import {
    beatmapSets,
    currentLoadingInfo,
    currentSkin,
    currentView,
    firstStartup,
    launcherStream,
    launcherStreams,
    launcherVersion,
    newVersion,
    osuBuild,
    osuStream,
    skins,
  } from '@/global';
  import {
    cursorSmoothness,
    osuInstallationPath,
    preferredMode,
    preferredType,
    userSettings,
  } from '@/userSettings';
  import { animate, utils } from 'animejs';
  import { onMount } from 'svelte';
  import SetupWizard from './SetupWizard.svelte';
  import Launch from './Launch.svelte';
  import { currentUser, userAuth } from '@/userAuthentication';
  import { ezppfarm } from '@/api/ezpp';
  import { toast } from 'svelte-sonner';
  import { currentUserInfo } from '@/data';
  import {
    getBeatmapSetsCount,
    getEZPPLauncherStreams,
    getReleaseStream,
    getSkin,
    getSkinsCount,
    getVersion,
    isValidOsuFolder,
  } from '@/osuUtil';
  import { git } from '@/api/git';

  let ezppLogo: HTMLImageElement;
  let spinnerCircle: SVGCircleElement;
  let animateInterval: number | undefined;

  //TODO: use this to check for updates upon launch

  const doBPMAnimation = () => {
    if (animateInterval) return;
    animateInterval = window.setInterval(async () => {
      animate(ezppLogo, {
        scale: 1.1,
        duration: 900,
        ease: (t: number) => Math.pow(2, -5 * t) * Math.sin((t - 0.075) * 20.94) + 1 - 0.0005 * t,
        onComplete: () => {},
      });
      await new Promise((resolve) => setTimeout(resolve, 200));
      animate(ezppLogo, {
        scale: 1,
        duration: 900,
        ease: (t: number) => (t - 1) ** 7 + 1,
        onComplete: () => {},
      });
    }, 450);
  };

  const calculateCursorSmoothness = async () => {
    const refreshRate = await estimateRefreshRate();
    const hzMin = 60;
    const hzMax = 144;
    const durationMin = 70;
    const durationMax = 180;

    const duration =
      durationMin + ((refreshRate - hzMin) / (hzMax - hzMin)) * (durationMax - durationMin);

    cursorSmoothness.set(Math.round(duration));
  };

  const prepare = async () => {
    await calculateCursorSmoothness();

    const username = $userAuth.value('username').get('');
    const password = $userAuth.value('password').get('');
    if (username.length > 0 && password.length > 0) {
      currentLoadingInfo.set('Logging in...');
      try {
        const loginResult = await ezppfarm.login(username, password);
        if (loginResult && loginResult.user) {
          toast.success('Login successful!', {
            description: `Welcome back, ${loginResult.user.name}!`,
          });

          currentUser.set(loginResult.user);
        } else {
          toast.error('Login failed!', {
            description: 'Please check your username and password.',
          });
        }
      } catch {
        toast.error('Server error occurred during login.', {
          description: 'There was an issue connecting to the server. Please try again later.',
        });
      }
    }
    if ($currentUser) {
      currentLoadingInfo.set('Loading user info...');
      const userInfo = await ezppfarm.getUserInfo($currentUser.id);
      if (userInfo) {
        currentUserInfo.set(userInfo.player);

        preferredMode.set(userInfo.player.info.preferred_mode);
        preferredType.set(userInfo.player.info.preferred_type);
      }
    }

    if (!$firstStartup) {
      currentLoadingInfo.set('Checking osu installation path...');
      const validFolder = await isValidOsuFolder($osuInstallationPath);
      if (!validFolder) {
        osuInstallationPath.set('');
        $userSettings.value('osu_installation_path').del();
        await $userSettings.save();
        toast.error('Oops...', {
          description: 'Your previously set osu! installation path seems to be invalid.',
        });
      } else {
        currentLoadingInfo.set('Getting osu version...');
        const osuReleaseStream = await getReleaseStream($osuInstallationPath);
        osuStream.set(osuReleaseStream);
        const osuVersion = await getVersion($osuInstallationPath);
        osuBuild.set(osuVersion);

        currentLoadingInfo.set('Counting beatmapsets...');
        const beatmapSetCount = await getBeatmapSetsCount($osuInstallationPath);
        if (beatmapSetCount) beatmapSets.set(beatmapSetCount);

        currentLoadingInfo.set('Counting skins...');
        const skinCount = await getSkinsCount($osuInstallationPath);
        if (skinCount) skins.set(skinCount);
        const skin: string = await getSkin($osuInstallationPath);
        currentSkin.set(skin);
      }
    }

    currentLoadingInfo.set('Checking for EZPPLauncher updates...');
    const launcherUpdate = await git.hasUpdate($launcherVersion);
    if (launcherUpdate) {
      newVersion.set(launcherUpdate);
    }

    const ezpplauncherStreams = await getEZPPLauncherStreams();
    if (ezpplauncherStreams) launcherStreams.set(ezpplauncherStreams);

    const selectedLauncherStream = $userSettings.value('patcherStream').get('stable');
    if ($launcherStreams.includes(selectedLauncherStream)) {
      launcherStream.set(selectedLauncherStream);
    }

    animate(ezppLogo, {
      opacity: [1, 0],
      scale: [1, 1.05],
      duration: 1000,
      ease: (t: number) => (t - 1) ** 7 + 1,
      onComplete: () => {},
    });
    animate(spinnerCircle, {
      opacity: 0,
      duration: 1000,
      ease: (t: number) => (t - 1) ** 7 + 1,
      onComplete: () => {},
    });
    setTimeout(() => {
      if ($firstStartup) currentView.set(SetupWizard);
      else currentView.set(Launch);
    }, 250);
  };

  onMount(() => {
    animate(ezppLogo, {
      opacity: [0, 1],
      scale: [0.95, 1],
      duration: 900,
      ease: (t: number) => (t - 1) ** 7 + 1,
      onComplete: doBPMAnimation,
    });
    animate(spinnerCircle, {
      strokeDashoffset: [0, -565],
      duration: 1800,
      easing: 'linear',
      loop: true,
    });

    prepare();

    return () => {
      window.clearInterval(animateInterval);
      utils.remove(spinnerCircle);
    };
  });
</script>

<div class="flex flex-col items-center justify-center mt-[50px] h-[calc(100vh-50px)] w-full">
  <div class="relative w-80 h-80 flex items-center justify-center">
    <svg
      class="absolute top-0 left-0 w-full h-full animate-spin"
      style="animation-duration: 5s;"
      viewBox="0 0 208 208"
    >
      <circle
        cx="104"
        cy="104"
        r="90"
        fill="none"
        stroke="#ff0098"
        stroke-width="8"
        stroke-linecap="round"
        stroke-dasharray="180 385"
        stroke-dashoffset="0"
        bind:this={spinnerCircle}
      />
    </svg>
    <img
      src={Logo}
      alt="EZPPLauncher Logo"
      class="w-52 h-52 mb-2 relative z-10"
      bind:this={ezppLogo}
    />
  </div>
  <span class="text-theme-200 text-sm mt-5">{$currentLoadingInfo}</span>
</div>
