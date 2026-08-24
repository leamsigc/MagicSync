---
layout: blog-layout
title: "The Easy Way to Use Web Workers in Nuxt"
description: "Run heavy JS off the main thread in Nuxt with Vite worker imports - the simple ?worker pattern, real examples, and pitfalls to avoid."

featured: true
tags:
  - Nuxt
  - Web Worker
  - Vue
  - Vite
author:
  name: Leamsigc
  role: Full Stack Developer
  avatar: /users/leamsigc.jpg
  social: https://bsky.app/profile/leamsigc.com
image:
  src: /media/easy-service-worker-nuxt.png
  alt: Easy way to use Web Worker in Nuxt v3/v4

ogImage:
  component: BlogOgImage
  props:
    image: /media/easy-service-worker-nuxt.png
    readingMins: 5
publishedAt: 2024-10-02
---

::BaseBlogHero
::

### The easy way of  using Web Worker in Nuxt.

Base in the Vite documentation:

A web worker script can be directly imported by appending `?worker` or `?sharedworker` to the import request. The default export will be a custom worker constructor:

```ts
import MyWorker from './worker?worker'

const worker = new MyWorker()
```

The worker script can also use ESM `import` statements instead of `importScripts()`. **Note**: During development this relies on [browser native support](https://caniuse.com/?search=module%20worker), but for the production build it is compiled away.

By default, the worker script will be emitted as a separate chunk in the production build. If you wish to inline the worker as base64 strings, add the `inline` query:

```ts

import MyWorker from './worker?worker&inline'


```

If you wish to retrieve the worker as a URL, add the `url` query:

```
import MyWorker from './worker?worker&url'
```

See [Worker Options](https://vite.dev/config/worker-options.html) for details on configuring the bundling of all workers.

---


How to create a web worker in your nuxt project:


Nuxt v4 Example:

1. Create a `customWebWorker.js`  in the `app/assets` folder, or you can create a folder specifically for the workers : `app/assets/workers/customWebWorker.js`
2. Create a composable  or import the worker in the component, but will recommend to used in a composable `app/composables/useCustomWorker.ts`
3. import the web worker in the composable 
```vue
// This assume that you created a folder for all the workers
import customWebWorker from "@/assets/workers/customWebWorker?worker";

```
4. Now you can create a ref for that worker

```ts
//useCustomWorker.ts
import customWebWorker from "@/assets/workers/customWebWorker?worker";

const useCustomWorker = () => {
	//...other functions

	const worker = ref<Worker | null>(null);


	const startWorker = ()=>{
		worker.value = new customWebWorker();
		worker.value.onmessage = (event) => {
                const { 
                type, // -> This will depend on you if you are emmiting from the web worker
                //...other data params emmited from the worker
				} = event.data;

                switch (type) {
                    case 'status':
                        //...Handle something here
                        break;
                    case 'error':
	                    //...Handle error here
                        break;
                    case 'result':
		                // ...
                        break;
                }
            };
		
	}

	const postMessageToWorker = ()  =>{

		//Remember that the object sended to the worker is on you 
		// this is just a example
		worker.value?.postMessage({ type: 'START', payload: { //...payload } });
	}

	return {
		startWorker,
		postMessageToWorker
		//...other exports	
	}
}
```


Here is an example of web worker that I use  for voice to text transcription for https://human-ideas.giessen.dev/tools/audio-text-notes


```js
//...import if you are using a package for some background work
  
import { pipeline } from "@huggingface/transformers";


const BASE_MODEL = 'Xenova/whisper-tiny.en';
let transcriber = null;
let isEnglishModel = true;

self.onmessage = async (event) => {
	//This will be base on the event that you send 
    const { type, payload } = event.data;

    switch (type) {
        case 'loadModel':
            try {
                self.postMessage({ type: 'status', status: 'loading', progress: 0 });
                if (payload.model.includes('.en')) {
                    isEnglishModel = true;
                }
                else {
                    isEnglishModel = false;
                }
                console.log('Loading model:', payload.model || BASE_MODEL);
                console.log('Is English:', isEnglishModel);

                transcriber = await pipeline('automatic-speech-recognition', payload.model || BASE_MODEL);
                self.postMessage({ type: 'status', status: 'loaded', progress: 100 });
            } catch (error) {
                self.postMessage({ type: 'error', error: error.message });
            }
            break;

        case 'transcribe':
            if (!transcriber) {
                self.postMessage({ type: 'error', error: 'Model not loaded' });
                return;
            }
            try {
                self.postMessage({ type: 'status', status: 'transcribing', progress: 0 });
                const { audio, language, model } = payload;
                console.log('Transcribing audio:', audio, 'with language:', language, 'and model:', model);
                const settings = {
                    language,
                    return_timestamps: true
                };

                const result = await transcriber(audio, !isEnglishModel ? settings : {});
                self.postMessage({ type: 'status', status: 'done', progress: 100 });
                self.postMessage({ type: 'result', result });
            } catch (error) {
                self.postMessage({ type: 'error', error: error.message });
            }
            break;

        case 'unloadModel':
            transcriber = null;
            self.postMessage({ type: 'status', status: 'unloaded', progress: 100 });
            break;

        default:
            self.postMessage({ type: 'error', error: 'Unknown message type' });
            break;
    }
};

```


