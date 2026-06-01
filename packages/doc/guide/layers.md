# The MagicSync Castle — Understanding Our Building Blocks

Welcome to the architecture behind MagicSync! Our project is organized as a monorepo with layer packages. Each layer has a special job!

---

## 🗃️ The Treasure Room — `@local-monorepo/db`

**The Database Layer** stores everything!

### What It Does
- Stores all posts, users, business profiles, and settings
- Uses **Drizzle ORM** — a super organized librarian
- Uses **Turso** (libSQL) — fast and reliable storage with vector support

### Superpowers
- Never forgets your data
- Super fast like a race car
- Keeps everything organized
- Native vector support for AI features

---

## 🔐 The Gatekeeper — `@local-monorepo/auth`

**The Auth Layer** is like the security guard at the castle entrance!

### What It Does
- Checks who you are (login, registration)
- Keeps bad guys out
- Manages passwords and sessions
- Uses **Better Auth** — a super trustworthy security system

### Superpowers
- Login and registration
- Session management
- Server protection
- Works with the Database to remember everyone

---

## 🎨 The Design Room — `@local-monorepo/ui`

**The UI Layer** makes everything look beautiful!

### What It Does
- Makes all the buttons, colors, and layouts
- Wraps **Nuxt UI v4** components with `Base-` prefix
- Uses **Tailwind CSS** — like having a magic paint box

### Superpowers
- Pre-made components (BaseButton, BaseCard, etc.)
- Dark and light modes
- Smooth animations
- Works on all screen sizes

---

## 🤖 The Innovation Lab — `@local-monorepo/ai-tools`

**The AI Tools Layer** is where the magic happens!

### What It Does
- Uses AI to help create content
- Generates ideas and improves posts
- Has a teleprompter for videos
- Analyzes your growth

### Features

**Growth Strategy Dashboard**
- Today's/This Week/This Month to-do lists
- 5 golden rules always visible
- 7/30/90 day action plans

**Content Pipeline**
- Idea brainstorming
- Hook variations (4 proven types)
- AI Health Check
- Teleprompter with speed control
- Edit checklist

**Data Analytics**
- Input your post stats
- Get instant recommendations

---

## 🖼️ The Art Gallery — `@local-monorepo/assets`

**The Assets Layer** stores images, icons, and files!

### What It Does
- Stores all images, icons, and static files
- Makes them available to every other layer
- Keeps everything organized

### Superpowers
- One place for ALL your media
- Shared across the whole castle
- Fast loading

---

## ⏰ The Time Tower — `@local-monorepo/scheduler`

**The Scheduler Layer** posts things at the perfect time!

### What It Does
- Decides WHEN to send your posts
- Manages a queue
- Talks to social media platforms
- Uses **FullCalendar** for the visual calendar

### Connected Platforms
- Facebook, Instagram
- Twitter/X
- LinkedIn
- Bluesky
- TikTok, YouTube, Threads
- Reddit, Dribbble, WordPress, Dev.to

---

## 📋 The Bulk Post Office — `@local-monorepo/bulk-scheduler`

**The Bulk Scheduler Layer** handles thousands of posts at once!

### What It Does
- Reads CSV files
- Creates hundreds of posts instantly
- Perfect for planning big campaigns

### Superpowers
- Upload a list of 500 posts in seconds
- CSV format (easy to create in Excel)
- Smart validation

---

## 🤝 The Connector — `@local-monorepo/connect`

**The Connect Layer** makes friends with other social platforms!

### What It Does
- Handles OAuth ("Login with Facebook" buttons)
- Manages API connections to all platforms
- Stores access tokens securely

### Superpowers
- One-click social connections
- Secure token storage
- Multi-platform support

---

## 📝 The Story Room — `@local-monorepo/content`

**The Content Layer** is where blog posts and stories live!

### What It Does
- Uses **Nuxt Content** to manage static content
- Creates beautiful documentation
- Manages the knowledge base

### Superpowers
- Markdown support
- Beautiful code highlighting
- Fast page loads

---

## 📧 The Message Bird — `@local-monorepo/email`

**The Email Layer** sends important emails!

### What It Does
- Sends transactional emails
- Uses MJML for beautiful email templates
- Welcomes new users, resets passwords, and more

### Email Types
- Welcome emails
- Password resets
- Notifications
- Post schedule alerts

---

## 🔧 The Tools Workshop — `@local-monorepo/tools`

**The Tools Layer** provides in-browser utilities!

### What It Does
- Image editor (text over images)
- Video silence remover
- Social media preview generator
- Email preview generator

### Superpowers
- Works entirely in browser
- No server required
- Instant results

---

## 🏰 The Main Castle — `@local-monorepo/site`

**The Site Layer** brings everything together!

### What It Does
- Extends ALL other layers
- This is what users actually see and use
- The final product that makes magic happen

### What It Includes
- Everything from every layer
- All the pages users visit
- The main application

---

## 📚 The Library — `@local-monorepo/doc`

**The Documentation Layer** is the rulebook and map!

### What It Does
- Built with **VitePress**
- This very documentation you're reading
- Guides, tutorials, and references

---

## 📦 The Template Shop — `@local-monorepo/content/templates`

**The Templates Layer** has pre-made content formats!

### What It Does
- Stores chat templates
- Variable templates for customization
- Makes creating posts faster
- Keeps your brand consistent

---

## How They All Work Together

```
User visits the Site 🏰
    ↓
Auth checks who you are 🔐
    ↓
Database shows your data 🗃️
    ↓
AI helps create content 🤖
    ↓
Scheduler posts at the right time ⏰
    ↓
Connect talks to social platforms 🤝
    ↓
Email sends confirmation 📧
    ↓
Stats show how it went! 📊
```

---

## For Developers

If you're a developer wanting to contribute:

| Layer | Tech Stack |
|-------|------------|
| UI | Nuxt 4, Nuxt UI v4, Tailwind CSS |
| Auth | Better Auth, better-sqlite3 |
| DB | Drizzle ORM, Turso (LibSQL) |
| AI | Google Gemini 2.0 Flash, AI SDK |
| Scheduler | FullCalendar, Platform APIs |
| Email | MJML |
| Content | Nuxt Content |
| Site | Nuxt 4 (extends all layers) |

---

Now you understand the MagicSync castle! Each room has a special job, and together they make the magic happen!

Ready to explore more? Check out our [Installation Guide](/guide/installation)!