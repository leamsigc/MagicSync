IMPORTANT: Fallow the rules in the './.rules.md' file

The folowing task need to be completed:

1. Create a single page view in the /packages/scheduler/pages/posts/new  Where the complete page will be the content of the modal for a new post

so basically PostModalContent in a single page.


2. In the './packages/ai-tools' Create a page 'ai-tools/content-split' where the user:
    1. Enter a long form content or a url where the api can scrapeWebsite base on the url and use the content 
    1.5 if the user pass a url, the api will scrape the website and use the content
    2. User can select platforms to create the content for: you can use the prompt below base on what platform
    3. when the user click in generate for platforms -> this will make a call to `/api/v1/ai/repurpose` as post method 
    


```
{
  twitter: `Turn the following content into a Twitter thread (5-7 tweets).

Rules:
- First tweet must hook the reader (curiosity or bold claim)
- Each tweet should stand alone but flow together
- Use line breaks for readability
- End with a call to action or takeaway
- No hashtags in thread (except maybe last tweet)
- Keep each tweet under 280 characters
- Format as "1/" "2/" etc.

  `,
  linkedin: `Turn the following content into a LinkedIn post.

Rules:
- Start with a hook (first line matters most)
- Use short paragraphs (1-2 sentences each)
- Include a clear takeaway or lesson
- End with a question to drive engagement
- 150-250 words ideal
- Minimal emojis (0-2 max)

  `,
  instagram: `Turn the following content into an Instagram caption.

Rules:
- Start with a hook
- Use emojis naturally (not excessive)
- Break into short paragraphs
- End with a call to action
- Add 5-10 relevant hashtags at the end
- 100-150 words before hashtags

  `,
  email: `Generate 5 email subject lines for the following content.

Rules:
- Each under 50 characters
- Mix of styles: curiosity, benefit, question, urgency, personal
- No clickbait that doesn't deliver
- Would work for a newsletter
- Number them 1-5

  `,
  facebook: `Turn the following content into a Facebook post.

Rules:
- Can be slightly longer than other platforms
- Ask a question or invite discussion
- 100-200 words
- Can use 1-2 emojis if appropriate

  `,
  tiktok: `Turn the following content into a TikTok video script.

Rules:
- Format as a spoken script with clear sections: HOOK, BODY, CTA
- HOOK (0-3 sec): Start with a pattern interrupt or bold statement to stop the scroll
- BODY (15-45 sec): Break into 3-5 short, punchy points. Write exactly what to say.
- CTA (3-5 sec): Clear call to action (follow, comment, save, share)
- Keep total script under 60 seconds when spoken
- Include [VISUAL CUE] notes in brackets for on-screen text or actions
- Add energy markers like (pause), (lean in), (point at camera) where helpful
- No hashtags in the script itself

  `
},
tones = {
  professional: 'professional and authoritative',
  casual: 'casual and conversational',
  witty: 'witty, playful, and clever',
  inspirational: 'inspirational and motivating',
  direct: 'direct and to-the-point'
},

```



Usage:

```
{{Platform}}
 Content: {{CONTENT}}

Write in a {TONE} tone of voice
```

3. Give the user the posibility of selecting PlatformSelector and use the created content from the reporpuse content and override the global post base on the selected platform
 example if the user pass long content,
 1. select twitter, linkeding,facebook
 2. generate the content for specific platform
 3. Select a twitter account, linkeding account, facebook account
 4. the global will be the first platform selected
 5, each platform will have its own content, account, and settings
 6. and for example if the platform have split content then use the hook as the main post and the rest will be as a comment
