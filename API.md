# BioForge API Documentation

## Overview

BioForge uses Supabase for backend operations. The API is divided into:
1. **Authentication** - Supabase Auth
2. **Database** - Supabase PostgREST
3. **Storage** - Supabase Storage
4. **Custom Endpoints** - Astro API routes

## Base URLs

### Development
- App: `http://localhost:4321`
- Supabase: `http://localhost:54321`

### Production
- App: `https://your-domain.vercel.app`
- Supabase: `https://your-project.supabase.co`

## Authentication Endpoints

### POST `/api/register`
Register a new user account.

**Request Body:**
```json
{
  "username": "string (3-20 chars, lowercase, numbers, underscores)",
  "email": "string (valid email)",
  "password": "string (min 8 chars)"
}
```

**Success Response:** `200 OK`
```json
{
  "success": true
}
```

**Error Response:** `400 Bad Request`
```json
{
  "error": "Error message"
}
```

**Side Effects:**
- Creates auth user in Supabase
- Creates profile in `profiles` table
- Sets authentication cookies

---

### POST `/api/login`
Log in an existing user.

**Request Body:**
```json
{
  "email": "string",
  "password": "string"
}
```

**Success Response:** `200 OK`
```json
{
  "success": true
}
```

**Error Response:** `401 Unauthorized`
```json
{
  "error": "Invalid email or password"
}
```

**Side Effects:**
- Sets authentication cookies

---

### POST `/api/logout`
Log out the current user.

**Success Response:** `302 Redirect`
- Redirects to `/login`

**Side Effects:**
- Clears authentication cookies

---

### GET `/api/track-click`
Track a link click and redirect to target URL.

**Query Parameters:**
- `id` - Link UUID
- `url` - Target URL (URL-encoded)

**Success Response:** `302 Redirect`
- Redirects to target URL

**Side Effects:**
- Increments click count via `increment_link_click()` RPC

---

## Database Schema

### Tables

#### `profiles`
User profile information.

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID | Primary key |
| `user_id` | UUID | Foreign key to auth.users |
| `username` | TEXT | Unique username |
| `display_name` | TEXT | Display name (nullable) |
| `bio` | TEXT | Bio (max 160 chars, nullable) |
| `avatar_url` | TEXT | Avatar URL (nullable) |
| `theme` | JSONB | Theme settings |
| `plan` | TEXT | Subscription plan |
| `is_active` | BOOLEAN | Account active status |
| `created_at` | TIMESTAMP | Creation date |
| `updated_at` | TIMESTAMP | Last update date |

**Constraints:**
- Username: `/^[a-z0-9_]{3,20}$/`
- Bio: Max 160 characters
- Display name: Max 50 characters

**Indexes:**
- `user_id` (unique)
- `username` (unique)
- `is_active`

---

#### `links`
User links to display on profile.

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID | Primary key |
| `profile_id` | UUID | Foreign key to profiles |
| `title` | TEXT | Link title (max 100 chars) |
| `url` | TEXT | Link URL (must be http/https) |
| `position` | INTEGER | Display order |
| `active` | BOOLEAN | Active status |
| `created_at` | TIMESTAMP | Creation date |
| `updated_at` | TIMESTAMP | Last update date |

**Constraints:**
- Title: Max 100 characters
- URL: Must match `/^https?://`

**Indexes:**
- `profile_id`
- `active`
- `position`

---

#### `daily_profile_stats`
Aggregated daily profile view counts.

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID | Primary key |
| `profile_id` | UUID | Foreign key to profiles |
| `date` | DATE | Stats date |
| `views` | INTEGER | View count |

**Unique Constraint:** `(profile_id, date)`

**Indexes:**
- `profile_id`
- `date`

---

#### `daily_link_stats`
Aggregated daily link click counts.

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID | Primary key |
| `link_id` | UUID | Foreign key to links |
| `date` | DATE | Stats date |
| `clicks` | INTEGER | Click count |

**Unique Constraint:** `(link_id, date)`

**Indexes:**
- `link_id`
- `date`

---

## RPC Functions

### `increment_profile_view(p_username TEXT)`
Increment the view count for a profile.

**Parameters:**
- `p_username` - Profile username

**Returns:** `void`

**Side Effects:**
- Inserts or updates `daily_profile_stats` for today

**Example:**
```javascript
const { error } = await supabase.rpc('increment_profile_view', {
  p_username: 'johndoe'
});
```

---

### `increment_link_click(p_link_id UUID)`
Increment the click count for a link.

**Parameters:**
- `p_link_id` - Link UUID

**Returns:** `void`

**Side Effects:**
- Inserts or updates `daily_link_stats` for today

**Example:**
```javascript
const { error } = await supabase.rpc('increment_link_click', {
  p_link_id: 'uuid-here'
});
```

---

## Row Level Security (RLS)

### Profiles

**Public SELECT:**
- Anyone can view active profiles (`is_active = true`)

**Authenticated SELECT:**
- Users can view their own profile

**Authenticated UPDATE:**
- Users can update their own profile

**Authenticated INSERT:**
- Users can create their own profile

---

### Links

**Public SELECT:**
- Anyone can view active links of active profiles

**Authenticated SELECT:**
- Users can view all their own links

**Authenticated INSERT:**
- Users can create links for their profile

**Authenticated UPDATE:**
- Users can update their own links

**Authenticated DELETE:**
- Users can delete their own links

---

### Daily Stats Tables

**Authenticated SELECT:**
- Users can view stats for their own profile/links

**No Direct Modifications:**
- All modifications must go through RPC functions

---

## Storage Buckets

### `avatars`
Public bucket for user avatars.

**Policies:**
- **SELECT**: Public read access
- **INSERT**: Authenticated users only
- **UPDATE**: Authenticated users only
- **DELETE**: Authenticated users only

**Usage:**
```javascript
// Upload avatar
const { data, error } = await supabase.storage
  .from('avatars')
  .upload('user-id.jpg', file, { upsert: true });

// Get public URL
const { data: { publicUrl } } = supabase.storage
  .from('avatars')
  .getPublicUrl('user-id.jpg');
```

---

## Rate Limits

### Profile Views
- No hard limit (uses caching)
- Cached for 60 seconds per profile

### Link Clicks
- No hard limit (fire-and-forget tracking)

### API Requests
- Follows Supabase plan limits
- Free tier: ~500 concurrent connections

---

## Error Codes

| Code | Description |
|------|-------------|
| 200 | Success |
| 302 | Redirect |
| 400 | Bad Request (validation error) |
| 401 | Unauthorized (auth required) |
| 403 | Forbidden (RLS policy violation) |
| 404 | Not Found |
| 500 | Internal Server Error |

---

## Examples

### Create a Profile (Client-Side)

```javascript
// This happens automatically on registration
// via /api/register endpoint
```

### Update Profile

```javascript
const { data, error } = await supabase
  .from('profiles')
  .update({
    display_name: 'John Doe',
    bio: 'Content creator and streamer',
    theme: {
      primary_color: '#3b82f6',
      background_color: '#1e293b'
    }
  })
  .eq('user_id', user.id);
```

### Create a Link

```javascript
const { data, error } = await supabase
  .from('links')
  .insert({
    profile_id: profileId,
    title: 'YouTube Channel',
    url: 'https://youtube.com/@mychannel',
    position: 0
  });
```

### Get Public Profile

```javascript
const { data, error } = await supabase
  .from('profiles')
  .select(`
    *,
    links:links(*)
  `)
  .eq('username', 'johndoe')
  .eq('is_active', true)
  .single();
```

---

## Best Practices

1. **Always validate input** on both client and server
2. **Use RPC functions** for analytics (never direct INSERT)
3. **Respect RLS policies** - don't try to bypass them
4. **Cache profile pages** appropriately
5. **Use indexes** for optimal query performance
6. **Handle errors gracefully** with user-friendly messages

---

For more information, see the [README](./README.md) and [source code](./src).
