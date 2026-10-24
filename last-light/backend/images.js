import { StoryError } from './errors.js';

export const OPENAI_IMAGE_MODEL = 'gpt-image-2.5-flare';
export function imageConfiguration(env) {
  const provider = env.IMAGE_PROVIDER || (env.OPENAI_API_KEY ? 'openai' : 'gemini');
  if (!['openai','gemini'].includes(provider)) throw new StoryError('The image provider configuration is invalid.',503,'MODEL_CONFIG');
  return {
    provider, model: provider === 'openai' ? env.OPENAI_IMAGE_MODEL || OPENAI_IMAGE_MODEL : env.GEMINI_IMAGE_MODEL || 'gemini-nano-banana-2.1',
    enabled: env.ENABLE_IMAGE_GENERATION === 'true' && Boolean(provider === 'openai' ? env.OPENAI_API_KEY : env.GEMINI_API_KEY || env.GOOGLE_API_KEY),
    quality: 'low', size: '1024x1024', references: provider === 'gemini' || env.OPENAI_IMAGE_USE_REFERENCE === 'true',
  };
}

export function illustrationPrompt(state) {
  return `Create one cinematic environmental illustration for an interactive story. Art direction: ${state.setup.artStyle}. Mood: ${state.setup.tone}. Preserve the described cast appearances. Scene: ${state.scene.imagePrompt}\nCast: ${JSON.stringify(state.characters.map(c=>({name:c.name,appearance:c.appearance})))}. The app draws inspectable objects as separate foreground sprites, so leave breathing room in the lower foreground. Do not paint captions, letters, UI, hotspots, or readable text. Do not reveal anything hidden inside an object. Use a complete composition without borders.`;
}

export function validateReference(reference) {
  if (reference && (!['image/png','image/jpeg','image/webp'].includes(reference.mimeType) || typeof reference.data !== 'string' || reference.data.length > 2500000 || !/^[A-Za-z0-9+/]+=*$/.test(reference.data))) throw new StoryError('The illustration reference is invalid.');
}

export function checkedImage(data, mimeType) {
  if (!['image/png','image/jpeg','image/webp'].includes(mimeType) || typeof data !== 'string' || !data || data.length > 12000000 || !/^[A-Za-z0-9+/]+=*$/.test(data)) throw new StoryError('The illustration could not be completed. You can continue playing or retry the image.',502,'IMAGE_FAILED');
  return `data:${mimeType};base64,${data}`;
}

export async function generateOpenAIImage(state,env,reference,fetcher=fetch) {
  if (!env.OPENAI_API_KEY) throw new StoryError('OpenAI image generation is not connected. Add the project’s OpenAI API key, or continue with the atmospheric scene.',503,'OPENAI_NOT_CONFIGURED');
  const config=imageConfiguration(env);
  if (!/^gpt-image-[a-z0-9.-]+$/.test(config.model)) throw new StoryError('The OpenAI image model setting is invalid.',503,'MODEL_CONFIG');
  const settings={model:config.model,prompt:illustrationPrompt(state),n:1,quality:'low',size:'1024x1024',output_format:'jpeg',output_compression:75};
  let path='generations'; let body; const headers={Authorization:`Bearer ${env.OPENAI_API_KEY}`};
  if (config.references && reference) {
    validateReference(reference); path='edits'; body=new FormData();
    for (const [key,value] of Object.entries(settings)) body.set(key,String(value));
    const bytes=Uint8Array.from(atob(reference.data),c=>c.charCodeAt(0));
    body.append('image[]',new Blob([bytes],{type:reference.mimeType}),'reference.'+(reference.mimeType.split('/')[1]));
  } else { headers['content-type']='application/json'; body=JSON.stringify(settings); }
  let response;
  try { response=await fetcher(`https://api.openai.com/v1/images/${path}`,{method:'POST',headers,body,signal:AbortSignal.timeout(110000)}); }
  catch { throw new StoryError('The illustration took too long. Your story is safe; retry the image when you are ready.',504,'IMAGE_TIMEOUT'); }
  let result;
  try { result=await response.json(); }
  catch { throw new StoryError('The image service returned an unreadable response. Please retry the illustration.',502,'IMAGE_FAILED'); }
  if (!response.ok) {
    if (result.error?.type === 'insufficient_quota' || ['insufficient_quota','billing_hard_limit_reached','credit_balance_exhausted'].includes(result.error?.code)) throw new StoryError('The OpenAI API project has no available credits. Add API credits at platform.openai.com/settings/organization/billing, or continue without an AI illustration.',429,'IMAGE_QUOTA');
    if (response.status === 429) throw new StoryError('OpenAI image generation is temporarily rate limited. Wait before retrying; your story is saved.',429,'IMAGE_RATE_LIMITED');
    if ([401,403].includes(response.status)) throw new StoryError('OpenAI could not authorize image generation. Check the API key and image-model access.',502,'OPENAI_ACCESS');
    if (response.status === 400) throw new StoryError('OpenAI could not illustrate this scene with the current settings. Your story can continue without the image.',502,'IMAGE_REQUEST_REJECTED');
    throw new StoryError('OpenAI image generation is unavailable. Continue playing or retry the illustration later.',502,'IMAGE_FAILED');
  }
  const format=result.output_format || 'jpeg';
  const mimeType={jpeg:'image/jpeg',png:'image/png',webp:'image/webp'}[format];
  return {dataUrl:checkedImage(result.data?.[0]?.b64_json,mimeType),provider:'openai',quality:'low'};
}
