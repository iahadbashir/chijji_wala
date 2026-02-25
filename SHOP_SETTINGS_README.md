# Shop Settings Setup

## Database Migration Required

A new `shop_settings` table needs to be created in your Supabase database.

### Option 1: Run via Supabase Dashboard (Recommended)

1. Go to your Supabase project dashboard
2. Navigate to **SQL Editor**
3. Copy the contents of `supabase/migrations/003_shop_settings_table.sql`
4. Paste into the SQL Editor and click **Run**
5. Verify the table was created in the **Table Editor**

### Option 2: Run via Supabase CLI

If you have the Supabase CLI installed:

```bash
supabase migration up
```

## Table Schema

The `shop_settings` table includes:

| Column          | Type        | Description                                    |
| --------------- | ----------- | ---------------------------------------------- |
| `id`            | UUID        | Primary key                                    |
| `is_open`       | BOOLEAN     | Shop status (true = open, false = closed)      |
| `banner_message`| TEXT (null) | Optional announcement shown on homepage        |
| `updated_at`    | TIMESTAMPTZ | Auto-updated timestamp                         |
| `is_singleton`  | BOOLEAN     | Singleton enforcement (always true)            |

## Features

### Shop Status Toggle
- Instantly enable/disable order placement
- Customers see a notice when shop is closed
- Useful for holidays, emergencies, or maintenance

### Banner Message
- Display promotional announcements on homepage
- Examples:
  - "🌧️ Rainy day special - Free delivery!"
  - "🎉 20% off all cakes this week"
  - "⚡ Express delivery available"
- Leave empty to hide banner
- 200 character limit

## Access the Settings

After running the migration:

1. Login to admin dashboard: `your-domain.com/admin/login`
2. Click **⚙️ Settings** in the sidebar
3. Toggle shop status or update banner message
4. Changes take effect immediately

## Security

- **Public read access**: Customers can view shop status and banner
- **Service role only**: Only admin server actions can modify settings
- **Singleton pattern**: Enforces exactly one settings row
