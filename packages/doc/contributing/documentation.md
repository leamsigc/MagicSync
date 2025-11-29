---
category: Contributing
---

# Documentation

<FunctionInfo fn="documentation"/>

This guide covers how to contribute to MagicSync documentation.

## Documentation Structure

MagicSync documentation is built with VitePress and located in `packages/doc/`:

```
doc/
├── .vitepress/             # VitePress configuration
│   ├── config.mts          # Site configuration
│   └── theme/              # Custom theme
├── guide/                  # User guides
│   ├── introduction.md
│   ├── quick-start.md
│   ├── pricing.md
│   └── ...
└── contributing/           # Contributing guides
    ├── development-setup.md
    ├── adding-features.md
    └── ...
```

## Writing Documentation

### Creating a New Guide

1. Create a new `.md` file in the appropriate directory
2. Add frontmatter:

```markdown
---
category: Guide
---

# Your Guide Title

Brief introduction to what this guide covers.

## Section 1

Content...

## Section 2

Content...
```

### Markdown Features

#### Code Blocks

Use fenced code blocks with language specification:

````markdown
```typescript
// Your code here
const example = 'Hello World'
```

```bash
pnpm install
```
````

#### Callouts

Use VitePress custom containers:

```markdown
::: tip
Helpful tip for users
:::

::: warning
Important warning
:::

::: danger
Critical information
:::
```

#### Links

Link to other documentation pages:

```markdown
See the [Quick Start](/guide/quick-start) guide.
Check [Platform Keys](/guide/platform-keys) for API setup.
```

### Documentation Standards

**Be Clear and Concise:**
- Use simple language
- Avoid jargon when possible
- Explain technical terms

**Use Examples:**
- Provide code examples
- Show real-world use cases
- Include screenshots when helpful

**Keep It Updated:**
- Update docs when features change
- Remove outdated information
- Test code examples

## Running Documentation Locally

```bash
# Start documentation dev server
pnpm doc

# Build documentation
pnpm doc:build

# Preview built documentation
pnpm doc:start
```

The documentation will be available at `http://localhost:5173`

## Documentation Types

### User Guides

Located in `guide/`, these help users accomplish tasks:

- Getting started guides
- Feature tutorials
- Configuration guides
- Troubleshooting

### Contributing Guides

Located in `contributing/`, these help contributors:

- Development setup
- Adding features
- Architecture overview
- Documentation standards

## Style Guide

### Headings

```markdown
# Page Title (H1) - One per page

## Main Section (H2)

### Subsection (H3)

#### Detail (H4)
```

### Lists

```markdown
**Unordered:**
- Item 1
- Item 2
  - Nested item

**Ordered:**
1. First step
2. Second step
3. Third step
```

### Code Inline

Use backticks for inline code: `const variable = 'value'`

### Emphasis

- **Bold** for important terms: `**bold**`
- *Italic* for emphasis: `*italic*`

## Adding Screenshots

1. Save screenshots to `packages/doc/public/images/`
2. Reference in markdown:

```markdown
![Alt text](/images/screenshot.png)
```

## Updating Navigation

Edit `.vitepress/config.mts` to update the sidebar:

```typescript
sidebar: {
  '/guide/': [
    {
      text: 'Getting Started',
      items: [
        { text: 'Introduction', link: '/guide/introduction' },
        { text: 'Quick Start', link: '/guide/quick-start' },
      ],
    },
  ],
}
```

## Documentation Checklist

Before submitting documentation changes:

- [ ] Spelling and grammar checked
- [ ] Code examples tested
- [ ] Links verified
- [ ] Screenshots added (if needed)
- [ ] Navigation updated (if new page)
- [ ] Builds successfully (`pnpm doc:build`)

## Getting Help

- Check existing documentation for examples
- Ask in [GitHub Discussions](https://github.com/leamsigc/magicsync/discussions)
- Review [VitePress documentation](https://vitepress.dev)

---

## Source
<SourceLinks fn="documentation"/>

## Contributors
<Contributors fn="documentation"/>

## Changelog
<Changelog fn="documentation"/>
