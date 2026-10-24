// Test responses only. These fixtures are never imported by production code.
export function sceneFixture(index = 1, chosen = null) {
  return {
    storyTitle: 'The City That Forgot', chapterTitle: index === 5 ? 'A memory worth keeping' : `The missing morning ${index}`,
    location: 'The glass observatory',
    narration: [
      chosen ? `You chose to ${chosen.label.toLowerCase()}. The city responds: a hidden door opens beneath the observatory.` : 'You arrive at an underwater observatory with a letter in your own handwriting. Beyond the glass, the city lights are going out.',
      index === 5 ? 'The decision you made in the observatory has changed the city. Your partner remembers your courage, and daylight returns.' : 'Your partner offers a risky plan. You can trust them with the letter, or follow the echo behind the glass. Both paths have a cost.',
    ],
    choices: index === 5 ? [] : [ { id:'trust_partner',label:'Trust your partner',hint:'Share the letter and accept their help.' }, { id:'follow_echo',label:'Follow the echo alone',hint:'Keep the secret, but face the unknown yourself.' } ],
    characters:[{ id:'oru',name:'Oru',description:'Your octopus partner',appearance:'A small copper-colored octopus with round spectacles',relationship:index>1?'Remembers what you chose':'Curious but cautious' }],
    memorySummary: `The detective found a letter. Scene ${index} has happened.${chosen ? ` The player chose ${chosen.label}.` : ''}`,
    newFacts:[`The city revealed clue ${index}.`], imagePrompt:'An underwater observatory with a copper octopus and blue glass towers.',
    visual:{ setting:'ocean',sky:'#164556',accent:'#c4dfb2',foreground:'#102c37',timeOfDay:'night' }, isEnding:index===5,
  };
}
export function providerFixture(counter = {calls:0,prompts:[]}) {
  return async (url, options) => {
    counter.calls++;
    const body = JSON.parse(options.body);
    const prompt = JSON.parse(body.contents[0].parts[0].text);
    counter.prompts.push(prompt);
    return Response.json({ candidates:[{ finishReason:'STOP',content:{ parts:[{text:JSON.stringify(sceneFixture(prompt.currentSceneNumber,prompt.chosenAction))}] } }] });
  };
}
