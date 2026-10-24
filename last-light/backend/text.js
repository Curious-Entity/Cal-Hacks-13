import { StoryError } from './errors.js';

export const CLOUDFLARE_TEXT_MODEL = '@cf/qwen/qwen3-30b-a3b-fp8';
export const geminiKey = env => env.GEMINI_API_KEY || env.GOOGLE_API_KEY || '';
export const sessionSecret = env => env.STORY_SESSION_SECRET || geminiKey(env) || env.CLOUDFLARE_API_TOKEN || '';
const missing = () => new StoryError('Story generation is not configured. Connect Cloudflare Workers AI or Gemini on the server.',503,'NOT_CONFIGURED');

export function textConfiguration(env) {
  // Preserve existing Gemini setups; Cloudflare-only setups work without another key.
  const provider = env.TEXT_PROVIDER || (geminiKey(env) ? 'gemini' : 'cloudflare');
  if (!['cloudflare','gemini'].includes(provider)) throw new StoryError('The text provider configuration is invalid.',503,'MODEL_CONFIG');
  const configured = provider === 'gemini' ? Boolean(geminiKey(env)) : Boolean(env.CLOUDFLARE_API_TOKEN && /^[a-f0-9]{32}$/i.test(env.CLOUDFLARE_ACCOUNT_ID || ''));
  return {provider, configured, model:provider === 'cloudflare' ? env.CLOUDFLARE_TEXT_MODEL || CLOUDFLARE_TEXT_MODEL : env.GEMINI_TEXT_MODEL || 'gemini-3.5-flash-lite'};
}
export function requireTextConfiguration(env) {
  const config = textConfiguration(env);
  if (config.provider === 'cloudflare' && env.CLOUDFLARE_ACCOUNT_ID && !/^[a-f0-9]{32}$/i.test(env.CLOUDFLARE_ACCOUNT_ID)) {
    throw new StoryError('The Cloudflare Account ID must be the 32-character ID from the Workers AI dashboard.',503,'CLOUDFLARE_ACCOUNT_INVALID');
  }
  if (!config.configured) throw missing();
  return config;
}
export function textCredentialScope(env) {
  const config = textConfiguration(env);
  return JSON.stringify([config, config.provider === 'gemini' ? geminiKey(env) : [env.CLOUDFLARE_ACCOUNT_ID,env.CLOUDFLARE_API_TOKEN],sessionSecret(env)]);
}

// REST requests work in both the dependency-free local server and hosted Worker.
export async function generateCloudflareText(system, prompt, schema, env, fetcher) {
  const config = requireTextConfiguration(env);
  if (!/^@(cf|hf)\/[a-z0-9._-]+\/[a-z0-9._-]+$/i.test(config.model)) throw new StoryError('The project model configuration is invalid.',503,'MODEL_CONFIG');
  let response;
  try {
    response = await fetcher(`https://api.cloudflare.com/client/v4/accounts/${env.CLOUDFLARE_ACCOUNT_ID}/ai/run/${config.model}`, {
      method:'POST', headers:{'content-type':'application/json',Authorization:`Bearer ${env.CLOUDFLARE_API_TOKEN}`},
      body:JSON.stringify({
        messages:[{role:'system',content:system},{role:'user',content:prompt}],
        response_format:{type:'json_schema',json_schema:schema},
        max_tokens:5500,temperature:.7,stream:false,
      }), signal:AbortSignal.timeout(75000),
    });
  } catch { throw new StoryError('The storyteller took too long to respond. Your progress is safe; please retry.',504,'PROVIDER_TIMEOUT'); }
  // Never return or log raw provider errors, which may contain request details.
  const result = await response.json().catch(()=>null);
  if (!response.ok || result?.success === false) {
    const codes = Array.isArray(result?.errors) ? result.errors.map(error=>error.code) : [];
    if (codes.includes(3036)) throw new StoryError('Cloudflare’s daily Workers AI allowance has been used. Your scene is safe; retry after the daily reset.',429,'CLOUDFLARE_TEXT_LIMIT');
    if (response.status === 429) throw new StoryError('Cloudflare story generation is busy or rate limited. Your progress is safe; please retry shortly.',429,'RATE_LIMITED');
    if ([401,403].includes(response.status) || codes.some(code=>[10000,10001].includes(code))) throw new StoryError('Cloudflare rejected the Workers AI credentials. Check the Account ID and the token’s Workers AI permissions.',502,'CLOUDFLARE_ACCESS');
    if (response.status === 404) throw new StoryError('The configured model is not available for this project. Check the model setting.',502,'MODEL_UNAVAILABLE');
    if (response.status === 400) throw new StoryError('Cloudflare rejected the story settings or JSON schema. Check the text model configuration and retry.',502,'CLOUDFLARE_TEXT_REQUEST');
    throw new StoryError('Cloudflare could not complete this story scene. Your progress is safe; please retry.',502,'PROVIDER_ERROR');
  }
  // Workers AI models can return a chat-completion envelope or a response value.
  const output = result?.result;
  const choice = output?.choices?.[0];
  if (choice?.finish_reason && choice.finish_reason !== 'stop') throw new StoryError('The storyteller could not complete this scene. Try again, or adjust your premise.',502,'INCOMPLETE_SCENE');
  const content = choice?.message?.content ?? output?.response;
  try {
    const scene = typeof content === 'string' ? JSON.parse(content) : content;
    if (!scene || typeof scene !== 'object' || Array.isArray(scene)) throw new Error('Invalid scene');
    return scene;
  } catch { throw new StoryError('The storyteller returned an incomplete scene. Please retry.',502,'INVALID_MODEL_RESPONSE'); }
}
