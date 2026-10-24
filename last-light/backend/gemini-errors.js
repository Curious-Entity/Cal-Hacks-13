import { StoryError } from './errors.js';

// Classify upstream failures without returning their messages, metadata, or keys.
export async function geminiError(response) {
  const result=await response.json().catch(()=>({}));
  const error=result?.error;
  const details=Array.isArray(error?.details) ? error.details : [];
  const reasons=details.map(detail=>detail?.reason);
  const message=typeof error?.message==='string' ? error.message : '';
  if ([400,401,403].includes(response.status)) {
    if (/reported as leaked|key (?:has been |is )?(?:blocked|revoked)/i.test(message)) return new StoryError('Google has blocked the Gemini key used by this project. The project owner needs to replace it with a new key in the server configuration.',502,'GEMINI_KEY_BLOCKED');
    if (response.status===401 || reasons.some(reason=>['API_KEY_INVALID','API_KEY_EXPIRED'].includes(reason)) || /API key not valid/i.test(message)) return new StoryError('Gemini rejected this project’s API key. The project owner needs to replace the Gemini key in the server configuration, then retry.',502,'GEMINI_AUTH');
  }
  if (response.status===403) return new StoryError('Gemini denied this project access. Check its API-key restrictions, model permissions, and project eligibility in Google AI Studio.',502,'GEMINI_ACCESS');
  if (response.status===400 && error?.status==='FAILED_PRECONDITION') return new StoryError('The Gemini project does not meet the requirements for this request. Check its API access and billing settings in Google AI Studio.',502,'GEMINI_PROJECT_SETUP');
  if (response.status===400) return new StoryError('Gemini rejected the story request settings. The project owner needs to check the model and request configuration.',502,'GEMINI_REQUEST');
  if (response.status===402) return new StoryError('The Gemini project has no available prepaid credits. Check its billing balance in Google AI Studio.',502,'GEMINI_CREDITS');
  if (response.status===429) return new StoryError('The Gemini project has reached a rate or usage limit. Wait before retrying, or check its quota in AI Studio.',429,'RATE_LIMITED');
  if (response.status===404) return new StoryError('The configured model is not available for this project. Check the model setting.',502,'MODEL_UNAVAILABLE');
  return new StoryError('The storyteller is temporarily unavailable. Your progress is safe; please retry.',502,'PROVIDER_ERROR');
}
