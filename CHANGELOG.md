# Changelog

All notable changes to BioForge will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0] - 2024-01-01

### Added
- Initial MVP release
- User authentication (email/password via Supabase)
- User profiles with customization
  - Custom username (3-20 chars, lowercase, numbers, underscores)
  - Display name
  - Bio (max 160 characters)
  - Avatar upload to Supabase Storage
  - Theme customization (primary color, background color)
- Link management
  - Add, edit, delete links
  - Reorder links (up/down buttons)
  - Toggle link active/inactive
  - URL validation (http/https only, blocks javascript:)
- Public profile pages
  - SEO optimized with OpenGraph tags
  - Responsive design
  - Custom theming per user
  - Fast loading (single DB query)
  - HTTP caching (60s cache, 600s stale-while-revalidate)
- Analytics system
  - Daily aggregated profile views
  - Daily aggregated link clicks
  - Scalable RPC functions for increments
  - Dashboard stats view (coming soon)
- Security
  - Row Level Security (RLS) on all tables
  - HTTP-only auth cookies
  - Input validation client and server-side
  - Reserved username protection
  - XSS prevention
- Docker support
  - Full Docker Compose setup
  - Includes Supabase local stack
  - Hot reload for development
- Database
  - Complete SQL schema with migrations
  - Optimized indexes
  - Automatic updated_at triggers
  - UPSERT-based analytics for scalability
- Documentation
  - Comprehensive README
  - Contributing guidelines
  - Code comments
- CI/CD
  - GitHub Actions workflow
  - Automated build checks
  - Type checking

### Technical Details
- Built with Astro 4.x (SSR mode)
- TypeScript strict mode
- TailwindCSS for styling
- Supabase for backend
- Vercel-ready deployment
- Mobile-first responsive design

### Known Limitations
- No custom domains yet
- No payment integration
- No social login
- Basic analytics (views/clicks only)
- No drag-and-drop reordering (uses up/down buttons)

## [Unreleased]

### Planned
- Stripe payment integration
- Social login (Google, Discord, Twitch)
- Advanced analytics dashboard
- Link scheduling
- Custom domains
- Drag-and-drop link reordering
- Team/Agency accounts
- API for third-party integrations
- Themes marketplace
- A/B testing for links

---

## Version History

- **1.0.0** - Initial MVP release (2024-01-01)
