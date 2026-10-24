const MOODS = {
  cinematic: 'Cinematic and adventurous', mysterious: 'Mysterious and atmospheric',
  wonder: 'Strange and full of wonder', cozy: 'Cozy and lighthearted',
};
const ART_STYLES = {
  illustrated: 'Storybook illustration', watercolor: 'Dreamy watercolor', noir: 'Moody noir',
};

export const storyMood = setup => setup.tone === 'custom' ? setup.customMood : MOODS[setup.tone] || setup.tone;
export const artDirection = setup => setup.artStyle === 'custom' ? setup.customArtStyle : ART_STYLES[setup.artStyle] || setup.artStyle;
