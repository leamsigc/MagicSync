# Bulk Post Generation Guide

Bulk Generation allows you to create a high volume of recurring or themed content using intelligent templates and automated distribution. This is perfect for "Tuesday Tips," product highlights, or holiday countdowns.

## How it Works

Instead of writing each post manually, you create one **Template** with "blanks" (variables). The system then "fills in the blanks" and spreads the posts across your chosen date range.

### 1. Template Syntax
Use double curly braces `{{ }}` to define where variables should be inserted.
*   **Example**: "Join us this {{day}} for a special offer at {{location}}!"

### 2. Variables
*   **System Variables**: Pre-defined values like `{{date}}`, `{{day}}`, `{{month}}`, and `{{year}}`.
*   **Custom Variables**: Define your own keys (e.g., `{{product_name}}`) and the system will prompt you for the specific values to use.

## Configuration Options

### Variable Management and Data Table
The core of Bulk Generation is the dynamic data table:
1.  **Add Custom Variables**: Use the "Add Custom Variable" button to define the keys you want to use in your template (e.g., `product_name`, `price`, `feature`).
2.  **Define Row Data**: For each post you want to generate, add a row to the "Content Data" table. Each row will represent one scheduled post.
3.  **Automatic Mapping**: The system will automatically inject the values from each row into your template using the corresponding variable keys.

### Scheduling and Distribution
*   **Total Posts**: The system will generate exactly as many posts as you have rows in your data table.
*   **Date Range**: Select the period during which these posts should be distributed. The system automatically calculates the optimal posting times based on your range.
*   **Skip Weekends / Business Hours**: Fine-tune the distribution to ensure your content goes live when your audience is most active.

## Using the Generate Tool

1.  **Define Variables**: First, identify the dynamic parts of your post and add them as custom variables.
2.  **Enter Content**: Build your "Content Data" table by adding rows and filling in the values for each variable.
3.  **Draft Your Template**: Write the main content in the editor, using double curly braces (e.g., `{{feature}}`) to reference your variables.
4.  **Set the Range**: Choose your start and end dates.
5.  **Review**: Scroll through the list of generated posts to see exactly how your table data merges with the template.
6.  **Generate**: Click **Generate Posts** to schedule the entire batch.

## Best Practices
*   **Variety**: Use the `first comment` feature to add different hashtags or calls-to-action to each generated post.
*   **Review**: Always check the **Preview** panel to ensure your variables are being replaced correctly without awkward spacing.
