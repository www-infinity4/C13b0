import {boundedImageSearch} from '../bounded-image-search';
test('available images remain available to the source-backed page',async()=>{expect(await boundedImageSearch(async()=>['actual-image'])).toEqual(['actual-image']);});
test('an unavailable image provider cannot prevent building the sourced text page',async()=>{expect(await boundedImageSearch(async()=>{throw Error('offline')})).toEqual([]);});
test('a provider that never responds has a bounded wait',async()=>{expect(await boundedImageSearch(()=>new Promise<string[]>(()=>{}),10)).toEqual([]);});
