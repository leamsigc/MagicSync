# Social media scheduling using Nuxt layers

## ⚠️ Project Status: In Progress

This project is currently under development and not yet complete. Features may be missing or unstable.


![Home](./images/HomePage.png)
![Home-v2](./images/HomePage-2.png)
![App](./images/Screenshot%202025-10-17%20at%2011-20-43%20App%20%40local-monorepo_site.png)
![Image Editor](./images/Screenshot%202025-10-17%20at%2011-20-51%20Image%20Editor%20%40local-monorepo_site.png)
![Blog MagicSync](./images/Screenshot%202025-10-17%20at%2011-20-59%20Blog%20Social%20magic%20-%20Social%20Media%20Scheduling%20Platform%20%40local-monorepo_site.png)
![Web Worker Nuxt](./images/Screenshot%202025-10-17%20at%2011-21-08%20Must%20Know%20Resources%20The%20easy%20way%20of%20using%20Web%20Worker%20in%20Nuxt.%20%40local-monorepo_site.png)
![Upload](./images/Screenshot%202025-10-17%20at%2011-21-24%20Upload%20%40local-monorepo_site.png)
![Media](./images/Screenshot%202025-10-17%20at%2011-21-37%20Media%20%40local-monorepo_site.png)
![Media v2](./images/Screenshot%202025-10-17%20at%2011-22-03%20Media%20%40local-monorepo_site.png)
![Business initial](./images/Business-initila.png)
![Home Image](./images/homeImage.png)
![Title Page](./images/Screenshot%202025-12-05%20at%2001-53-01%20title%20%40local-monorepo_site.png)
![UI Preview](./images/Screenshot%202025-12-05%20at%2001-53-21%20Ui%20Preview%20%40local-monorepo_site.png)
![Base Hero](./images/Screenshot%202025-12-05%20at%2001-53-44%20Base%20Hero%20%40local-monorepo_site.png)
![Best Free Tools](./images/Screenshot%202025-12-05%20at%2001-53-59%20Best%20free%20Tools%20%40local-monorepo_site.png)
![Upload New](./images/Screenshot%202025-12-05%20at%2001-54-23%20Upload%20%40local-monorepo_site.png)
![Media New 1](./images/Screenshot%202025-12-05%20at%2001-54-30%20Media%20%40local-monorepo_site.png)
![Media New 2](./images/Screenshot%202025-12-05%20at%2001-54-38%20Media%20%40local-monorepo_site.png)
![Bulk Create](./images/Screenshot%202025-12-05%20at%2001-54-46%20Bulk%20Create%20%40local-monorepo_site.png)
![Month Calendar 1](./images/Screenshot%202025-12-05%20at%2001-54-56%20Month%20Calendar%20%40local-monorepo_site.png)
![Month Calendar 2](./images/Screenshot%202025-12-05%20at%2001-55-07%20Month%20Calendar%20%40local-monorepo_site.png)
![Month Calendar 3](./images/Screenshot%202025-12-05%20at%2001-55-15%20Month%20Calendar%20%40local-monorepo_site.png)
![Month Calendar 4](./images/Screenshot%202025-12-05%20at%2001-55-28%20Month%20Calendar%20%40local-monorerepo_site.png)
![Month Calendar 5](./images/Screenshot%202025-12-05%20at%2001-56-04%20Month%20Calendar%20%40local-monorepo_site.png)
![Month Calendar 6](./images/Screenshot%202025-12-05%20at%2001-56-22%20Month%20Calendar%20%40local-monorepo_site.png)
![Month Calendar 7](./images/Screenshot%202025-12-05%20at%2001-56-42%20Month%20Calendar%20%40local-monorepo_site.png)
![All Posts 1](./images/Screenshot%202025-12-05%20at%2001-57-07%20All%20Posts%20%40local-monorepo_site.png)
![All Posts 2](./images/Screenshot%202025-12-05%20at%2001-57-18%20All%20Posts%20%40local-monorepo_site.png)
![Connected Social Media Platforms](./images/Screenshot%202025-12-05%20at%2001-57-26%20Connected%20social%20media%20platforms%20%40local-monorepo_site.png)
![Connect Account](./images/Screenshot%202025-12-05%20at%2001-57-33%20Connect%20your%20Connect%20account%20%40local-monorepo_site.png)
![Business Management](./images/Screenshot%202025-12-05%20at%2001-57-39%20Business%20Management%20%40local-monorepo_site.png)
![Chat Templates 1](./images/Screenshot%202025-12-05%20at%2001-57-46%20Chat%20Templates%20%40local-monorepo_site.png)
![Chat Templates 2](./images/Screenshot%202025-12-05%20at%2001-57-54%20Chat%20Templates%20%40local-monorepo_site.png)
![Variable Templates 1](./images/Screenshot%202025-12-05%20at%2001-58-01%20Variable%20Templates%20%40local-monorepo_site.png)
![Variable Templates 2](./images/Screenshot%202025-12-05%20at%2001-58-09%20Variable%20Templates%20%40local-monorepo_site.png)
![Screenshot from 2025-12-05 01-55-35](./images/Screenshot%20from%202025-12-05%2001-55-35.png)
![Screenshot from 2025-12-05 01-55-45](./images/Screenshot%20from%202025-12-05%2001-55-45.png)
![Screenshot from 2025-12-05 01-55-52](./images/Screenshot%20from%202025-12-05%2001-55-52.png)

## Project layers Structure using Monorepo

1. @local-monorepo/db
2. @local-monorepo/auth
3. @local-monorepo/assets
4. @local-monorepo/scheduler
5. @local-monorepo/connect
6. @local-monorepo/tools
7. @local-monorepo/ai-tools
8. @local-monorepo/bulk-scheduler
9. @local-monorepo/content
10. @local-monorepo/site
11. @local-monorepo/ui
12. @local-monorepo/email
13. @local-monorepo/doc



## Database Schema and Relationships

The main application is a social media scheduling platform built using Nuxt in a monorepo structure, allowing users to manage multiple business profiles, connect social media accounts, schedule posts across platforms, handle media assets, track customer reviews, and manage subscriptions.

Example relationships: A user can own multiple business profiles; each business profile can be linked to several social media accounts for cross-platform posting; posts can be associated with media assets uploaded by the user for richer content.

```mermaid
erDiagram
  USER ||--o{ BUSINESS_PROFILES : has
  USER ||--o{ SOCIAL_MEDIA_ACCOUNTS : owns
  USER ||--o{ ASSETS : uploads
  USER ||--o{ POSTS : creates
  USER ||--o{ SUBSCRIPTIONS : has
  BUSINESS_PROFILES ||--o{ SOCIAL_MEDIA_ACCOUNTS : manages
  BUSINESS_PROFILES ||--o{ ASSETS : has
  BUSINESS_PROFILES ||--o{ POSTS : creates_for
  BUSINESS_PROFILES ||--o{ REVIEWS : receives
  SOCIAL_MEDIA_ACCOUNTS ||--o{ PLATFORM_POSTS : publishes_to
  POSTS ||--o{ PLATFORM_POSTS : transforms_to
  ASSETS ||--|| USER : uploaded_by
  ASSETS ||--|o BUSINESS_PROFILES : associated_with
  POSTS ||--|| USER : created_by
  POSTS ||--|| BUSINESS_PROFILES : created_for
  PLATFORM_POSTS ||--|| POSTS : originates_from
  PLATFORM_POSTS ||--|| SOCIAL_MEDIA_ACCOUNTS : belongs_to
  REVIEWS ||--|| BUSINESS_PROFILES : for
  SUBSCRIPTIONS ||--|| USER : for
  TOOLS
```

## Explanation for each layer


1. @local-monorepo/db
> All related database call or connections will be here
> Query to the db will be here from user information to assets information.
- Database will have the connection configuration
- Schema for the following:
    - User
    - Post
    - Connection
    - Tool
    - Template
    - Prompt
    - Email
    - Settings
    - Log
    - assets
    - business



2. @local-monorepo/auth

> The auth layer will be using the Better auth package
> The routes for the ui for the login, registration, logout will be here.
> User role management will be here api.
- User can register
- User can login
- User can logout
- User can change password
- User can change email
- User can verify email
- Admin user can manage users
- Admin user can ban users


3. @local-monorepo/assets
> All related assets will be here, from Upload, download, external api call for images example Pexel API
> Upload, single to bulk images.


4. @local-monorepo/scheduler
> The api for scheduling one or more post will be here
> The UI for the scheduling will be here as well

- User can view the post scheduler
- Api will trigger post base on the schedule
- User can create a new schedule
- User can edit a schedule
- User can delete a schedule
- User can view the calendar view of the schedules
- User can view the list view of the schedules
- User can export the schedules to a csv file


5. @local-monorepo/connect
> Supported platforms will be here
> API for the connection handlers will be here
> UI for the connection handlers will be here, Ui for the connected platforms as well
- User can see all the supported platforms
- User can connect to a platform
- User can disconnect from a platform
- User can see all the connected platforms
- User can group the connected platforms
- User can see all the groups
- User can add a group
- User can edit a group
- User can delete a group
- User can edit the platform details



6. @local-monorepo/tools
> All related tools will be here
> UI for the tools will be here
> Tools will be target to be public tools to get seo rank and traffic, most tools will use the Transformerjs library
> Example: Auto generate images from text base on a template html to png image
> UI for the preview for the images will be here
- In browser tools for social media
- In browser tools for email
- In browser tools for chat
- In browser tools for social media preview generator
- In browser tools for email preview generator
- In browser tools for transcription




7. @local-monorepo/ai-tools
> All related tools will be here
> UI for the tools will be here

> Example: Auto generated post for  social media, based on a prompt or the user business details, 
> like the business name, description, and the user profile.
> UI for the preview for the generated post will be here
> Chat interface for the ai tools
- User can ask for a new social media post, base on user prompt 
- User can ask to re-generate social media post base on the current post
- All post will be generated and formatted to be ready for social media and formatted to with text + hashtags

8. @local-monorepo/bulk-scheduler
> The api for generating bulk post will be here and bulk scheduling
> The UI for the scheduling will be here as well

- User can generate bulk post and schedule from date A to date B for multiple platforms
- User can generate bulk post, with auto generated images base on a template html and schedule from date A to date B for multiple platforms


9. @local-monorepo/content
> Here we handle the Static content like the blog posts, and static pages for the application
- Home pages
- About page
- Contact page
- Privacy policy
- Terms of service





10. @local-monorepo/site

> Here is where all the  Layers will be merged together
> The UI  for the combined layers will be here

- Seo for the site
- Sitemap for the site
- Robots for the site
- Favicon for the site


11. @local-monorepo/ui
> The base UI for all the layers will be here
- UI layer will be using the Nuxt UI,
- UI layer will expose the UI components with a prefix like Base-, example `BaseButton.vue` that will be just a proxy to the Nuxt UI `Button.vue`

12. @local-monorepo/email
> The email service will be here
> The email templates will be here
- User can edit the email template
- User can have preview of the email template
- All email that the system send will be here
- User can update the email settings

13. @local-monorepo/doc

> The documentation for the layers will be here
> The documentation for the ui will be here



## Setup

To try the project locally, follow these steps:

1. Clone the repository
2. Run `pnpm i` to install dependencies
3. Create a `.env` file based on the `.env-example` file (fill in the required values)
4. Run `pnpm packages db db:generate` and `pnpm packages db db:migrate` to set up the database
5. Run `pnpm packages [layer] dev` for each layer you want to work on (e.g., `pnpm packages ui dev`, `pnpm packages auth dev`, etc.)
6. Finally, run `pnpm packages site dev` to start the main site

### Currently Working Features

- User registration and login
- Assets management
- Tools
- Connection to Google and Facebook
- Connect Facebook page
- Create/update posts
- Calendar view of scheduled posts (Month, Week, Day views)
- Hover on posts in calendar shows preview based on platform

### Specific Layer Commands

- Install dependencies for a layer: `pnpm packages [layer] install`
- Start dev server for a layer: `pnpm packages [layer] dev`
- Build a layer: `pnpm packages [layer] build`
- Start production server for a layer: `pnpm packages [layer] start`

Example: `pnpm packages ui dev` for the dev server for the ui layer 




## Todos:
- [x] Set up the UI Layer using Nuxt UI
    - [x] Create the components that will be used in the Home page
    - [x]  About page
    - [x]  Contact page
    - [x]  Privacy policy page
    - [x]  Terms of service page
    - [x]  Blog page
    - [x]   Blog post page


- [x] Create the static content layer
    - [ ] Create Home, About, Contact, Privacy policy, Terms of service
    - [x] Create Blog posts for each task that is done.


- [ ] Create the tools layer
    - [ ] Create the tools for social media
    - [ ] Create the tools for email
    - [ ] Create the tools for chat
    - [ ] Create the tools for social media preview generator
    - [ ] Create the tools for email preview generator
    - [ ] Create the tools for transcription
    - [x] Create the tools for Text over image


- [x] Set up the Database Layer
  - [x] Create User model
  - [x] Create Post model
  - [x] Create Schedule model
  - [x] Create Task model
  - [x] Create Group model
  - [x] Create Message model
  - [x] Create Platform model



- [ ] Set up the Email Layer
    - [ ] Create template email for User Registration
    - [ ] Create template email for User Password Reset
    - [ ] Create template email for User Password Change
    - [ ] Create template email for User confirmation
    - [ ] Create template email for User Subscription
    - [ ] Create template email for User Unsubscription
    - [ ] Create template email for Post Schedule trigger
    - [ ] Create template email for Post Schedule fail
    - [ ] Create template email for Post Schedule reminder

- [ ] Set up the Auth Layer
    - [x] Create login page
    - [x] Create signup page
    - [ ] Create forgot password page
    - [ ] Create reset password page
    - [ ] Create confirm email page
    - [ ] Create subscription page
    - [ ] Create unsubscribe page
    - [ ] Create profile page
    - [ ] Create settings page
    - [x] Set up the middleware for the auth
    - [ ] Set up the middleware for the admin
    - [ ] Set up the middleware for the guest
    - [ ] Set up the middleware for the user
    - [ ] Set up the middleware for the subscription
    - [ ] Set up the middleware for the schedule rights
    - [ ] Set up the Better Auth package

- [ ] Set up the Scheduler Layer
    - [ ] Create the api for scheduling one or more post
    - [ ] Create the UI for the scheduling
    - [ ] Create the api for generating bulk post
    - [ ] Create the UI for the bulk scheduling
    - [ ] Create the api for generating bulk post with auto generated images
    - [ ] Create the UI for the bulk scheduling with auto generated images
    - [ ] Create the Calendar view for the schedules
    - [ ] Create the List view for the schedules
    - [ ] Create the api for exporting the schedules to a csv file
    - [ ] Create the api for importing the schedules from a csv file


- [ ] Set up the Connect Layer
    -[ ] Create UI & API for supported platforms
    -[ ] Create UI & API for connected platforms
    -[ ] Create UI & API for groups
    -[ ] Create UI & API for group details
    -[ ] Create UI & API for group creation
    -[ ] Create UI & API for group editing
    -[ ] Create UI & API for group deleting
    -[ ] Create UI & API for platform details
    -[ ] Create UI & API for platform creation
    -[ ] Create UI & API for platform editing
    -[ ] Create UI & API for platform deleting
    -[ ] Create UI & API for platform connection
    -[ ] Create API for connecting to a platform
    -[ ] Create API for disconnecting from a platform


- [ ] Set up the AI Layer
    - [ ] Create the api for generating post
    - [ ] Create the UI for the post generation
    - [ ] Create the api for generating bulk post
    - [ ] Create the UI for the bulk post generation
    - [ ] Create the api for generating bulk post with auto generated images
    - [ ] Create the UI for the bulk post generation with auto generated images

- [ ] Set up the Analytics Layer
    - [ ] Create the api for analytics
    - [ ] Create the UI for the analytics

- [x] Set up the assets Layer
    - [x] Create the api for CRUD operations for assets
    - [x] Create the UI for the CRUD operations for the assets
    - [] Create UI & API to create template assets
