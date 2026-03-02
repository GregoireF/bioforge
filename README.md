# 🔗 BioForge

BioForge is a premium link-in-bio platform specifically designed for streamers and content creators. Built with modern web technologies, it offers a fast, scalable, and customizable solution for showcasing all your content in one place.

## ✨ Features

- 🎨 **Customizable Profiles** - Personalize your page with custom colors, avatar, and bioz
- 🔗 **Link Management** - Add, edit, reorder, and toggle links with ease
- 📊 **Analytics** - Track profile views and link clicks
- ⚡ **Lightning Fast** - Built with Astro SSR for optimal performance
- 🎯 **SEO Optimized** - Full OpenGraph and meta tag support
- 🔒 **Secure** - Row-Level Security with Supabase
- 📱 **Mobile First** - Fully responsive design
- 🚀 **Production Ready** - Scalable architecture ready for SaaS

## 🛠 Tech Stack

- **Frontend**: [Astro](https://astro.build) (SSR) + TypeScript + TailwindCSS
- **Backend**: [Supabase](https://supabase.com) (PostgreSQL + Auth + Storage)
- **Deployment**: [Vercel](https://vercel.com) (recommended)
- **Package Manager**: pnpm

## 📋 Prerequisites

- Node.js 20+ and pnpm
- Docker and Docker Compose (for local development)
- Supabase account (for production)
- Vercel account (for deployment)

## 🚀 Quick Start

### Option 1: Docker (Recommended for Development)

1. **Clone the repository**
```bash
git clone <your-repo-url>
cd bioforge
```

2. **Set up environment variables**
```bash
cp .env.example .env
```

For local development with Docker, use these values:
```env
PUBLIC_SUPABASE_URL=http://localhost:54321
PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0
PUBLIC_APP_URL=http://localhost:4321
```

3. **Start the application**
```bash
docker compose up --build
```

This will start:
- **BioForge App**: http://localhost:4321
- **Supabase API**: http://localhost:54321
- **Supabase Studio**: http://localhost:54323

4. **Access Supabase Studio**

Go to http://localhost:54323 and connect with:
- Database: `postgres`
- Password: `your-super-secret-and-long-postgres-password` (or your custom password from .env)

The database migrations will run automatically on first start.

### Option 2: Manual Setup (Without Docker)

1. **Install dependencies**
```bash
pnpm install
```

2. **Set up Supabase**

You have two options:

**A. Use Supabase Cloud (Production)**
- Create a project at [supabase.com](https://supabase.com)
- Copy your project URL and anon key to `.env`:
```env
PUBLIC_SUPABASE_URL=https://your-project.supabase.co
PUBLIC_SUPABASE_ANON_KEY=your-anon-key
PUBLIC_APP_URL=http://localhost:4321
```

**B. Use Supabase CLI (Local)**
```bash
# Install Supabase CLI
npm install -g supabase

# Initialize Supabase
supabase init

# Start local Supabase
supabase start
```

3. **Run migrations**

If using Supabase CLI:
```bash
supabase db push
```

If using Supabase Cloud:
- Go to your project dashboard
- Navigate to SQL Editor
- Copy and paste the contents of `supabase/migrations/20240101000000_initial_schema.sql`
- Run the SQL

4. **Create the avatars storage bucket**

In Supabase Studio (http://localhost:54323 or your cloud dashboard):
1. Go to Storage
2. Create a new bucket named `avatars`
3. Make it public
4. The SQL migration already created the necessary policies

5. **Start the dev server**
```bash
pnpm dev
```

The app will be available at http://localhost:4321

## 📁 Project Structure

```
bioforge/
├── src/
│   ├── components/         # Reusable UI components
│   │   ├── LinkButton.astro
│   │   ├── ProfileHeader.astro
│   │   └── Toast.astro
│   ├── layouts/           # Page layouts
│   │   ├── BaseLayout.astro
│   │   └── DashboardLayout.astro
│   ├── lib/               # Core logic
│   │   ├── analytics.ts   # Analytics helpers
│   │   ├── auth.ts        # Authentication utilities
│   │   ├── supabaseClient.ts
│   │   └── validators.ts  # Input validation
│   └── pages/             # Route pages
│       ├── api/           # API endpoints
│       │   ├── login.ts
│       │   ├── logout.ts
│       │   ├── register.ts
│       │   └── track-click.ts
│       ├── @[username].astro  # Public profile page
│       ├── dashboard.astro    # User dashboard
│       ├── index.astro        # Landing page
│       ├── login.astro
│       └── register.astro
├── supabase/
│   ├── migrations/        # Database migrations
│   │   └── 20240101000000_initial_schema.sql
│   └── kong.yml          # API gateway config
├── astro.config.mjs
├── docker-compose.yml
├── Dockerfile
├── package.json
├── tailwind.config.mjs
└── tsconfig.json
```

## 🗄️ Database Schema

### Tables

- **profiles** - User profiles with customization settings
- **links** - User links to display on their public page
- **daily_profile_stats** - Aggregated daily view counts
- **daily_link_stats** - Aggregated daily click counts

### Key Features

- ✅ Row Level Security (RLS) enabled on all tables
- ✅ Optimized indexes for performance
- ✅ Automatic `updated_at` triggers
- ✅ RPC functions for scalable analytics
- ✅ Username validation and reserved names
- ✅ URL validation (blocks javascript: protocol)

## 🔒 Security

- **Row Level Security (RLS)** enabled on all tables
- Users can only modify their own data
- Public profiles are read-only for visitors
- Analytics increments happen via secure RPC functions
- HTTP-only cookies for auth tokens
- Input validation on both client and server
- Reserved username protection
- XSS prevention via URL validation

## 📊 Analytics

BioForge includes a built-in analytics system that is:

- **Scalable** - Uses daily aggregation (no 1-row-per-view)
- **Efficient** - Utilizes PostgreSQL UPSERT for atomic operations
- **Secure** - Only accessible via RPC functions
- **Privacy-focused** - No personal data collection beyond counts

Analytics Functions:
- `increment_profile_view(username)` - Tracks profile views
- `increment_link_click(link_id)` - Tracks link clicks

## 🎨 Customization

Users can customize their profile page with:
- Display name and bio
- Avatar image (uploaded to Supabase Storage)
- Primary color (for link buttons)
- Background color
- Link ordering via drag & drop or up/down buttons

## 🚀 Deployment

### Vercel (Recommended)

1. **Push your code to GitHub**

2. **Import in Vercel**
   - Go to [vercel.com](https://vercel.com)
   - Import your GitHub repository
   - Framework Preset: Astro
   - Build Command: `pnpm build`
   - Output Directory: `dist`

3. **Set environment variables**
```env
PUBLIC_SUPABASE_URL=https://your-project.supabase.co
PUBLIC_SUPABASE_ANON_KEY=your-anon-key
PUBLIC_APP_URL=https://your-domain.vercel.app
```

4. **Deploy!**

The app will automatically deploy on every push to main.

### Supabase Production Setup

1. **Create a Supabase project**
   - Go to [supabase.com](https://supabase.com)
   - Create a new project

2. **Run migrations**
   - Go to SQL Editor
   - Run the migration file: `supabase/migrations/20240101000000_initial_schema.sql`

3. **Create avatars bucket**
   - Go to Storage
   - Create bucket named `avatars`
   - Make it public
   - Policies are already created by migration

4. **Get your credentials**
   - Go to Settings > API
   - Copy your Project URL and anon key

## 🧪 Development

### Available Scripts

```bash
pnpm dev          # Start dev server
pnpm build        # Build for production
pnpm preview      # Preview production build
pnpm lint         # Lint code
pnpm format       # Format code
```

### Testing Locally

1. Start the application via Docker or manually
2. Register a new account at http://localhost:4321/register
3. Set up your profile in the dashboard
4. Add some links
5. Visit your public page at http://localhost:4321/@yourusername

## 🔧 Configuration

### Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `PUBLIC_SUPABASE_URL` | Supabase project URL | Yes |
| `PUBLIC_SUPABASE_ANON_KEY` | Supabase anonymous key | Yes |
| `PUBLIC_APP_URL` | Your app's URL | Yes |

### Supabase Configuration

Default JWT settings (for local Docker):
- JWT Secret: `your-super-secret-jwt-token-with-at-least-32-characters-long`
- JWT Expiry: 3600 seconds

For production, use strong secrets from Supabase dashboard.

## 📈 Scalability

BioForge is designed to scale:

- **Database**: Indexed queries, optimized joins
- **Caching**: HTTP cache headers on public profiles (`s-maxage=60`)
- **CDN Ready**: Static assets via Vercel Edge Network
- **Analytics**: Daily aggregation prevents table bloat
- **Storage**: Supabase CDN for avatars

### Performance Tips

- Profile pages are cached for 60 seconds
- Only 1 database query per profile page load
- Static assets are served from CDN
- Optimized images via Supabase Storage

## 🛣️ Roadmap

Future features planned:
- [ ] Custom domains per user
- [ ] Stripe payment integration
- [ ] Advanced analytics dashboard
- [ ] Social login (Google, Discord, Twitch)
- [ ] Link scheduling
- [ ] A/B testing for links
- [ ] Team/Agency accounts
- [ ] API for third-party integrations
- [ ] Themes marketplace

## 🤝 Contributing

This is a private commercial project. If you have access to this repository:

1. Create a feature branch
2. Make your changes
3. Test thoroughly
4. Submit a pull request

## 📝 License

Proprietary - All rights reserved

## 🆘 Support

For issues or questions:
- Check existing issues on GitHub
- Create a new issue with detailed description
- Contact the development team

## 🙏 Credits

Built with:
- [Astro](https://astro.build)
- [Supabase](https://supabase.com)
- [TailwindCSS](https://tailwindcss.com)
- [Vercel](https://vercel.com)

---

**Made with ❤️ for streamers and creators**
