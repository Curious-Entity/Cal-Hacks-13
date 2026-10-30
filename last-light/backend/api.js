import {handleAPI as handleStoryAPI} from './adventure.js';
import {handleWorldAPI} from './world.js';

export function handleAPI(request,env={},fetcher=fetch) {
  return new URL(request.url).pathname.startsWith('/api/world/') ? handleWorldAPI(request,env,fetcher) : handleStoryAPI(request,env,fetcher);
}
