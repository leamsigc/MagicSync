# CSV Import Guide

The CSV Import feature allows you to schedule hundreds of social media posts at once by uploading a simple spreadsheet. This is the fastest way to plan your content for the entire month in minutes.

## CSV Format Requirements

To ensure a successful import, your CSV file must include a `content` column. You can also include optional columns for images and specific scheduling times.

| Column | Description | Format |
|--------|-------------|--------|
| `content` (Required) | The main text of your post. Supports emojis and hashtags. | Text |
| `image_url` | A link to an image asset you want to include. | Public URL (e.g., https://...) |
| `scheduled_time` | A specific date and time for this post. | ISO 8601 (e.g., 2026-02-15T10:00:00Z) |
| `comments` | Follow-up comments to be posted after the main content. | Semicolon separated (e.g., "Comment 1; Comment 2") |

> [!TIP]
> Use Google Sheets or Excel to prepare your file and then export it as `.csv`.

## Step-by-Step Import Process

### 1. Upload Your File
Navigate to the **Bulk Scheduler > CSV Import** page and drag-and-drop your `.csv` file. The system will automatically parse the headers and check for errors.

### 2. Configure Settings
*   **Select Business**: Choose which business account these posts belong to.
*   **Select Platforms**: Choose the social media accounts (Facebook, Instagram, LinkedIn, etc.) where you want to publish.
*   **Scheduling Mode**:
    *   **Keep CSV Times**: Uses the times provided in your `scheduled_time` column.
    *   **Distribute Evenly**: Ignores the CSV times and spreads the posts evenly across a date range you select.

### 3. Review and Schedule
Before finalizing, you can see a preview of all posts. The system will highlight any validation issues (e.g., post length limits for X/Twitter). Click **Import & Schedule** to finish.

## Error Handling
If some rows fail during the import (e.g., an invalid image URL), the system will notify you with a **Partial Success** warning. You can find the specific error details in your **Notifications** panel.
