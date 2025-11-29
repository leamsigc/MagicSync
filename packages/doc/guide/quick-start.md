# Quick Start

Get your first social media post scheduled in just **5 minutes**. This guide will walk you through the essential steps to start managing your social media with MagicSync.

## Prerequisites

Before you begin, make sure you have:
- A social media account (Facebook, Instagram, Twitter, etc.)
- 5 minutes of your time
- (Optional) Docker installed for self-hosting

## Step 1: Choose Your Setup (2 minutes)

### Option A: Cloud (Fastest)
```bash
# Visit our hosted platform
https://magicsync.dev/register
```

### Option B: Self-Hosted (Docker)
```bash
# Quick Docker setup
docker run -d \
  -p 3000:3000 \
  -e DATABASE_URL="your-db-url" \
  magicsync/app:latest
```

For detailed installation options, see [Installation Guide](/guide/installation).

## Step 2: Connect Your First Platform (2 minutes)

1. **Log in** to your MagicSync dashboard
2. **Click "Add Account"** in the sidebar
3. **Select your platform** (e.g., Facebook, Instagram, Twitter)
4. **Authorize** MagicSync to access your account
5. **Done!** Your account is now connected

::: tip Platform Setup Guides
Need help getting API keys? Check our [Platform Keys Guide](/guide/platform-keys) for step-by-step instructions for each platform.
:::

## Step 3: Create Your First Post (1 minute)

### Manual Post
1. Click **"Create Post"** button
2. Write your message or use **AI Generate** for suggestions
3. Add images or videos (optional)
4. Select which platforms to post to
5. Choose **"Post Now"** or **"Schedule"**

### AI-Generated Post
1. Click **"AI Generate"**
2. Enter a topic (e.g., "Monday motivation for coffee shop")
3. Review and edit the AI-generated content
4. Schedule or post immediately

::: code-group
```typescript [Example API Call]
// Create a post via API
const post = await fetch('/api/posts', {
  method: 'POST',
  body: JSON.stringify({
    content: 'Check out our new menu! 🍕',
    platforms: ['facebook', 'instagram'],
    scheduledAt: '2024-01-15T10:00:00Z',
    media: ['image-url.jpg']
  })
})
```

```bash [CLI Example]
# Schedule a post via CLI
magicsync post create \
  --content "New products arriving this week!" \
  --platforms facebook,instagram \
  --schedule "2024-01-15 10:00"
```
:::

## What's Next?

Now that you've created your first post, explore these features:

### 📅 **Set Up Your Content Calendar**
Plan your posts for the week or month ahead. [Learn about scheduling →](/guide/scheduling)

### 🤖 **Use AI Content Generation**
Generate bulk posts, holiday content, and captions automatically. [AI Features →](/guide/ai-features)

### 📊 **Track Your Performance**
Monitor engagement, reach, and growth across all platforms. [Analytics Guide →](/guide/analytics)

### 👥 **Invite Your Team**
Collaborate with team members and assign roles. [Team Management →](/guide/team-collaboration)

### 🔧 **Customize Your Workflow**
Set up automation rules and posting schedules. [Automation Guide →](/guide/automation)

## Common First Steps

### For Restaurants & Cafes
```markdown
✅ Connect Instagram and Facebook
✅ Upload your menu photos
✅ Schedule daily specials for the week
✅ Set up review response automation
```

### For Retail Stores
```markdown
✅ Connect all social platforms
✅ Create product showcase posts
✅ Schedule sale announcements
✅ Set up customer engagement workflows
```

### For Service Businesses
```markdown
✅ Connect LinkedIn and Facebook
✅ Share customer testimonials
✅ Schedule educational content
✅ Set up appointment reminders
```

## Video Tutorial

<VideoEmbed 
  title="Getting Started with MagicSync"
  description="Watch this 5-minute tutorial to see the complete setup process"
  provider="youtube"
  url="https://youtube.com/watch?v=example"
/>

## Troubleshooting

### Can't connect my account?
Make sure you have the correct permissions and API keys. See [Platform Keys Guide](/guide/platform-keys).

### Post not scheduling?
Check your timezone settings and ensure the scheduled time is in the future.

### Images not uploading?
Verify your image format (JPG, PNG, WebP) and size (max 10MB).

::: warning Need More Help?
Visit our [FAQ](/guide/faq) or join our [Community Support](https://github.com/leamsigc/magicsync/discussions).
:::

## Next Steps

<FeatureGrid :columns="3">
  <div class="feature-item">
    <div class="feature-icon">📚</div>
    <h3 class="feature-title">Learn the Basics</h3>
    <p class="feature-description">Explore all features and capabilities</p>
    <a href="/guide/features" class="feature-link">View Features →</a>
  </div>
  
  <div class="feature-item">
    <div class="feature-icon">🎯</div>
    <h3 class="feature-title">Use Cases</h3>
    <p class="feature-description">See how businesses like yours use MagicSync</p>
    <a href="/guide/use-cases" class="feature-link">Browse Use Cases →</a>
  </div>
  
  <div class="feature-item">
    <div class="feature-icon">💡</div>
    <h3 class="feature-title">Best Practices</h3>
    <p class="feature-description">Tips for social media success</p>
    <a href="/guide/best-practices" class="feature-link">Learn More →</a>
  </div>
</FeatureGrid>

---

**Questions?** Check our [FAQ](/guide/faq) or [contact support](/contact).
