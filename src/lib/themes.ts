import executionclap_video from '$assets/themes/execution_clap/video.webm';
import lostumbrella_video from '$assets/themes/lost_umbrella/video.webm';
import nyancat_image from '$assets/themes/nyan_cat/image.gif';
import nyancat_audio from '$assets/themes/nyan_cat/audio.mp3';

export const THEMES = [
  {
    name: 'default',
    display_name: 'Default',
    assets: {
      background_video: undefined,
      background_image: undefined,
      audio: undefined,
    },
  },
  {
    name: 'execution_clap',
    display_name: 'Execution Clap',
    assets: {
      background_video: executionclap_video,
      background_image: undefined,
      audio: undefined,
    },
  },
  {
    name: 'lost_umbrella',
    display_name: 'Lost Umbrella',
    assets: {
      background_video: lostumbrella_video,
      background_image: undefined,
      audio: undefined,
    },
  },
  {
    name: 'nyan_cat',
    display_name: 'Nyan Cat',
    assets: {
      background_video: undefined,
      background_image: nyancat_image,
      audio: nyancat_audio,
    },
  },
];
