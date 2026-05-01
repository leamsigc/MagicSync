<script lang="ts" setup>
import type { DisplayThread, Thread, ThreadViewPost } from '#layers/BaseUI/shared/BaseBlueSkyTypes';
import { useStorage } from '@vueuse/core'
/**
 *
 * Component Description:Desc
 *
 * @author Reflect-Media <reflect.media GmbH>
 * @version 0.0.1
 *
 * @todo [ ] Test the component
 * @todo [ ] Integration test.
 * @todo [✔] Update the typescript.
 */
interface Props {
  url: string
}

const storage = useStorage<Record<string, Record<string, unknown>>>('comments', {})
const props = defineProps<Props>();

const replies = ref<DisplayThread[]>([])
const post = ref<DisplayThread | null>(null)
const error = ref(false)

const sortedReplies = computed(() => {
  if (!replies.value.length) return []

  return replies.value.sort((a, b) => {
    return new Date(a.post.record.createdAt).getTime() -
      new Date(b.post.record.createdAt).getTime()
  })
})

const loadComments = async () => {
  if (!props.url) return

  try {
    const atUri = await resolvePostUrl(props.url)
    if (!atUri) {
      throw new Error("Failed to resolve AT URI")
    }
    const { thread } = await fetchReplies(atUri)
    if (thread?.replies) {
      replies.value = processReplies(thread.replies)
    }

    if (thread?.post) {
      const baseTreat = {
        ...thread,
        isReply: false,
        replies: []
      };
      post.value = baseTreat as unknown as DisplayThread;
    }
  } catch (e) {
    // Error is set to display user-friendly message
    error.value = true
  }
}

const resolvePostUrl = async (postUrl: string) => {
  if (postUrl.startsWith("at:")) {
    return postUrl
  }

  if (!postUrl.startsWith("https://bsky.app/")) {
    return undefined
  }

  const urlParts = new URL(postUrl).pathname.split("/")
  let did = urlParts[2]
  const postId = urlParts[4]

  if (!did || !postId) {
    return undefined
  }

  if (!did.startsWith("did:")) {
    const cachedDid = getCache(`handle:${did}`)
    if (cachedDid) {
      did = cachedDid
    } else {
      try {
        const handleResolutionUrl = `https://public.api.bsky.app/xrpc/com.atproto.identity.resolveHandle?handle=${encodeURIComponent(did)}`
        const handleResponse = await fetch(handleResolutionUrl)

        if (!handleResponse.ok) {
          throw new Error("Failed to resolve handle")
        }

        const handleData = await handleResponse.json()

        if (!handleData.did) {
          return undefined
        }


        setCache(`handle:${did}`, handleData.did, 86400)
        did = handleData.did
      } catch (e) {
        const error = e as Error
        // Error handled silently - URL resolution failed
        return undefined
      }
    }
  }

  return `at://${did}/app.bsky.feed.post/${postId}`
}

const fetchReplies = async (atUri: string) => {
  const apiUrl = `https://public.api.bsky.app/xrpc/app.bsky.feed.getPostThread?uri=${encodeURIComponent(atUri)}`
  const response = await fetch(apiUrl)
  if (!response.ok) {
    throw new Error("Failed to fetch replies")
  }
  return await response.json() as Thread
}

const processReplies = (replyThreads: ThreadViewPost[], isReply = false) => {
  return replyThreads.map(reply => {

    if (reply.post.record.text.trim() === "📌") {
      return null
    }

    (reply as unknown as DisplayThread).isReply = isReply
    if (reply.replies) {
      (reply as unknown as DisplayThread).replies = processReplies(reply.replies, true)
    }
    return reply as unknown as DisplayThread;
  }).filter(Boolean) as DisplayThread[];
}


const setCache = (key: string, value: unknown, ttl = 86400) => {
  const expiry = Date.now() + ttl * 1000
  const cacheData = { value, expiry }
  storage.value[key] = cacheData;
}

const getCache = (key: string) => {
  const cachedItem = storage.value[key];
  if (!cachedItem || !cachedItem.expiry) return null

  const { value, expiry } = cachedItem
  if (Date.now() > (expiry as number)) {
    storage.value[key] = {}
    return null
  }
  return value as string
}
watch(() => props.url, (newUrl) => {
  if (newUrl) {
    error.value = false
    replies.value = []
    loadComments()
  }
}, { immediate: true })

</script>

<template>
  <section class="container mx-auto  border-x" v-motion-fade-visible-once :delay="200" :duration="1200">
    <USeparator v-if="url" class="my-4" show-buckle />
    <div class="text-center mb-20">
      <h2 class="text-lg text-primary text-center mb-2 tracking-wider">
        <slot name="title" mdc-unwrap="p"> Comments </slot>
      </h2>

      <h3 class="text-3xl md:text-4xl text-center font-bold">
        <slot name="subtitle" mdc-unwrap="p">
          Be part of the conversation
          <Icon name="logos:bluesky" />
        </slot>
      </h3>
    </div>
    <div v-if="url" class=" font-sans text-base text-left">
      <div v-if="error" class="p-4 text-red-600">Error loading comments.</div>
      <template v-else>
        <section class="border-t border-primary/10">
          <BaseBlueSkyComment v-if="post" :thread="post" />
        </section>
        <BaseBlueSkyComment v-for="(thread, index) in sortedReplies" :key="index" :thread="thread" />
      </template>
    </div>
    <USeparator v-if="url" class="my-4" show-buckle />
  </section>
</template>
<style scoped></style>
